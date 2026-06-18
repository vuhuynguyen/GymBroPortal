import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  viewChild
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { loggedItemStatusToLabel, scheduledTimeToInput, type LoggedItemStatusLabel } from '../../nutrition-plans/nutrition-enums';
import { formatMacroLine, sumMacros, type MacroSet } from '../../nutrition-plans/nutrition-macros';
import { clampAdherencePct } from '../nutrition-adherence';
import type { DailyNutritionLogDetailDto, LoggedItemDto, LoggedMealDto } from '../nutrition-log.model';

interface ItemRow {
  id: string;
  name: string;
  detail: string;
  status: LoggedItemStatusLabel;
  isPlanned: boolean;
  note: string | null;
}

interface MealRow {
  name: string;
  time: string;
  items: ItemRow[];
}

/**
 * Nutrition day detail — centered modal over a scrim (clone of `session-detail-dialog`).
 * Adherence stat strip · per-meal item checklist with statuses. Scrim-click and Esc close.
 */
@Component({
  selector: 'app-nutrition-day-detail-dialog',
  standalone: true,
  imports: [],
  templateUrl: './nutrition-day-detail-dialog.html',
  styleUrl: './nutrition-day-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NutritionDayDetailDialogComponent implements AfterViewInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);

  readonly detail = input<DailyNutritionLogDetailDto | null>(null);
  readonly loading = input(false);
  readonly titleFallback = input('Nutrition day');

  readonly closed = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLElement>>('dialog');
  private previousOverflow = '';

  ngAfterViewInit(): void {
    // Lock background scroll and move focus into the dialog while it's open.
    this.previousOverflow = this.doc.body.style.overflow;
    this.doc.body.style.overflow = 'hidden';
    this.dialogRef()?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.doc.body.style.overflow = this.previousOverflow;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.closed.emit();
  }

  readonly title = computed(() => {
    const d = this.detail();
    if (!d) return this.titleFallback();
    const date = new Date(`${d.localDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return this.titleFallback();
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  });

  readonly isClosed = computed(() => String(this.detail()?.status ?? '').toLowerCase() === 'closed');

  readonly adherencePct = computed(() => clampAdherencePct(this.detail()?.adherencePct));

  /** Stat strip tiles — adherence, done/planned counts, and consumed kcal when present. */
  readonly statTiles = computed(() => {
    const d = this.detail();
    if (!d) return [] as { value: string; label: string }[];
    const tiles: { value: string; label: string }[] = [];
    if (d.plannedCount > 0) tiles.push({ value: `${this.adherencePct()}%`, label: 'Adherence' });
    tiles.push({ value: `${d.completedCount}`, label: 'Done' });
    if (d.plannedCount > 0) tiles.push({ value: `${d.plannedCount}`, label: 'Planned' });
    const kcal = this.consumedMacros().energyKcal;
    if (kcal != null) tiles.push({ value: `${Math.round(kcal)}`, label: 'kcal eaten' });
    return tiles;
  });

  /** Macros actually consumed (Completed/Substituted items only). */
  readonly consumedMacros = computed<MacroSet>(() => {
    const items = (this.detail()?.meals ?? []).flatMap((m) => m.items);
    const consumed = items.filter((i) => {
      const s = loggedItemStatusToLabel(i.status);
      return s === 'Completed' || s === 'Substituted';
    });
    return sumMacros(
      consumed.map((i) => ({
        energyKcal: i.energyKcal,
        proteinG: i.proteinG,
        carbsG: i.carbsG,
        fatG: i.fatG,
        fiberG: i.fiberG
      }))
    );
  });

  readonly consumedMacroLine = computed(() => formatMacroLine(this.consumedMacros()));

  readonly mealRows = computed<MealRow[]>(() =>
    (this.detail()?.meals ?? []).map((m) => this.toMealRow(m))
  );

  private toMealRow(meal: LoggedMealDto): MealRow {
    return {
      name: meal.name,
      time: scheduledTimeToInput(meal.scheduledTime),
      items: meal.items.map((i) => this.toItemRow(i))
    };
  }

  private toItemRow(item: LoggedItemDto): ItemRow {
    const macros = formatMacroLine({
      energyKcal: item.energyKcal,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      fiberG: item.fiberG
    });
    const qty = `${item.quantity} × ${item.servingLabel}`;
    return {
      id: item.id,
      name: item.foodName,
      detail: macros ? `${qty} · ${macros}` : qty,
      status: loggedItemStatusToLabel(item.status),
      isPlanned: item.isPlanned,
      note: item.note
    };
  }

  statusClass(status: LoggedItemStatusLabel): string {
    return status.toLowerCase();
  }

  statusIcon(status: LoggedItemStatusLabel): string {
    switch (status) {
      case 'Completed':
        return 'pi pi-check-circle';
      case 'Substituted':
        return 'pi pi-sync';
      case 'Skipped':
        return 'pi pi-minus-circle';
      case 'Missed':
        return 'pi pi-times-circle';
      default:
        return 'pi pi-circle';
    }
  }
}
