import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { take } from 'rxjs/operators';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { openDialogPortal } from '../../../shared/ui/dialog/attach-centered-dialog';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import {
  ButtonComponent,
  PageContainerComponent,
  PageHeaderComponent,
  PanelCardComponent
} from '../../../shared/ui';
import { FoodPickerPanelComponent, type FoodPickerAddPayload } from '../nutrition-plans/food-picker-panel/food-picker-panel';
import {
  formatMacroLine,
  scaleMacros
} from '../nutrition-plans/nutrition-macros';
import { loggedItemStatusToLabel, scheduledTimeToInput, type LoggedItemStatusLabel } from '../nutrition-plans/nutrition-enums';
import {
  adherenceTone,
  clampAdherencePct,
  relativeDayLabel,
  type AdherenceTone
} from '../client-nutrition/nutrition-adherence';
import { NutritionDayDetailDialogComponent } from '../client-nutrition/nutrition-day-detail-dialog/nutrition-day-detail-dialog';
import type {
  DailyNutritionLogDto,
  DailyNutritionLogSummaryDto,
  LoggedItemDto,
  LoggedMealDto
} from '../client-nutrition/nutrition-log.model';
import { MyNutritionService } from './my-nutrition.service';
import {
  OFF_PLAN_MEAL,
  consumedMacros,
  isDayClosed,
  mealOptions,
  nextToggleStatus
} from './my-nutrition-today';

interface ItemView {
  id: string;
  name: string;
  detail: string;
  status: LoggedItemStatusLabel;
  isPlanned: boolean;
  kind: string;
}

interface MealView {
  name: string;
  time: string;
  items: ItemView[];
}

/** One macro readout chip (kcal / protein / carbs / fat) for the day-summary strip. */
interface MacroChip {
  key: 'kcal' | 'p' | 'c' | 'f';
  label: string;
  value: string;
}

type Tab = 'today' | 'history';

/**
 * "My Nutrition" — a self-train owner's own daily nutrition log on the web (mirror of the Flutter Today
 * tab). Today: planned meals grouped, one-tap eat/skip, substitute & off-plan add via the shared food
 * picker, a day adherence ring + consumed-macro summary, and an inline weight/sleep check-in. History:
 * past days with adherence, drilling into a read-only day detail. Reads are self-scoped & cross-gym;
 * item writes are tenant-scoped (the active gym). Available to any authenticated member.
 */
@Component({
  selector: 'app-my-nutrition',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    PageContainerComponent,
    PageHeaderComponent,
    PanelCardComponent,
    ButtonComponent,
    FoodPickerPanelComponent,
    NutritionDayDetailDialogComponent
  ],
  templateUrl: './my-nutrition.html',
  styleUrl: './my-nutrition.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyNutritionComponent implements OnInit {
  private readonly service = inject(MyNutritionService);
  private readonly messageService = inject(MessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly tab = signal<Tab>('today');

  // Today state (from the service signals)
  readonly today = this.service.today;
  readonly todayLoading = this.service.todayLoading;
  readonly todayError = this.service.todayError;
  readonly checkin = this.service.checkin;

  // History state
  readonly historyDays = this.service.historyDays;
  readonly historyLoading = this.service.historyLoading;
  private historyLoaded = false;

  // Food picker slide-over — used both for off-plan add and to substitute a planned item.
  readonly pickerOpen = signal(false);
  /** When set, the picker is in "substitute" mode and its result swaps this planned item. */
  readonly substituteFor = signal<ItemView | null>(null);

  // History day-detail dialog
  readonly selectedDay = signal<DailyNutritionLogDto | null>(null);
  readonly detailLoading = signal(false);
  readonly detailOpen = signal(false);

  // Daily check-in form (hosted in a popup; see the check-in dialog overlay below)
  readonly checkinForm = this.fb.group({
    weight: this.fb.control<string>('', [Validators.min(0)]),
    sleep: this.fb.control<string>('', [Validators.min(0)])
  });

  // ── Daily check-in popup (shared centered-dialog overlay) ─────────────────
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly checkinTpl = viewChild<TemplateRef<unknown>>('checkinTpl');
  private checkinOverlayRef: OverlayRef | null = null;

  /** Drives the shared dialog overlay; `openCheckin()` opens it, backdrop/Esc/close clears it. */
  readonly checkinOpen = signal(false);

  readonly hasPlan = computed(() => !!this.today()?.hasPlan);
  readonly closed = computed(() => {
    const t = this.today();
    return t ? isDayClosed(t) : false;
  });

  readonly mealViews = computed<MealView[]>(() =>
    (this.today()?.meals ?? []).map((m) => this.toMealView(m))
  );

  readonly hasMeals = computed(() => (this.today()?.meals ?? []).some((m) => m.items.length > 0));

  /** "Log under" slots for an off-plan add: the day's meals + standard slots + the Off-plan bucket. */
  readonly offPlanMealOptions = computed<string[]>(() => {
    const opts = mealOptions(this.today() ?? { meals: [] });
    return opts.includes(OFF_PLAN_MEAL) ? opts : [...opts, OFF_PLAN_MEAL];
  });

  /**
   * True when the active assignment disables trainee self-editing — the logging affordances are hidden.
   * NOTE: the self-scoped day read (`/api/me/nutrition/today`) does not currently surface this flag (it
   * lives on the coach assignment DTO), so this is effectively off unless the API adds it to the day DTO.
   */
  readonly editingDisabled = computed(() => this.today()?.disableTraineeEditing === true);

  readonly adherencePct = computed(() => clampAdherencePct(this.today()?.adherencePct));
  readonly tone = computed<AdherenceTone>(() =>
    adherenceTone(this.adherencePct(), this.today()?.plannedCount ?? 0)
  );
  readonly ringDash = computed(() => {
    const pct = this.adherencePct();
    const circumference = 2 * Math.PI * 26; // r = 26 in the SVG ring
    return `${(pct / 100) * circumference} ${circumference}`;
  });

  readonly remainingLabel = computed(() => {
    const t = this.today();
    if (!t) return '';
    const remaining = Math.max(0, t.plannedCount - t.completedCount);
    if (t.plannedCount === 0) return 'Nothing planned today';
    if (this.closed()) return this.adherencePct() >= 80 ? 'Solid day — plan followed' : 'Day closed';
    return remaining === 0 ? 'Plan complete — nice work' : `${remaining} item${remaining === 1 ? '' : 's'} to go`;
  });

  /** Discrete consumed-macro chips (kcal/P/C/F) for the day-summary strip; empty when nothing eaten. */
  readonly consumedChips = computed<MacroChip[]>(() => {
    const m = consumedMacros(this.today() ?? { meals: [] });
    const chips: MacroChip[] = [];
    if (m.energyKcal != null) chips.push({ key: 'kcal', label: 'kcal', value: fmtMacro(m.energyKcal) });
    if (m.proteinG != null) chips.push({ key: 'p', label: 'Protein', value: `${fmtMacro(m.proteinG)}g` });
    if (m.carbsG != null) chips.push({ key: 'c', label: 'Carbs', value: `${fmtMacro(m.carbsG)}g` });
    if (m.fatG != null) chips.push({ key: 'f', label: 'Fat', value: `${fmtMacro(m.fatG)}g` });
    return chips;
  });

  trackChip(_i: number, chip: MacroChip): string {
    return chip.key;
  }

  constructor() {
    // Attach/detach the shared centered-dialog overlay in lock-step with `checkinOpen`.
    afterRenderEffect(() => {
      const shouldOpen = this.checkinOpen();
      const tpl = this.checkinTpl();
      if (shouldOpen && tpl && !this.checkinOverlayRef) {
        this.checkinOverlayRef = openDialogPortal(
          this.overlay,
          this.viewContainerRef,
          tpl,
          () => this.closeCheckin()
        );
        this.checkinOverlayRef
          .detachments()
          .pipe(take(1))
          .subscribe(() => {
            this.checkinOverlayRef = null;
            this.checkinOpen.set(false);
          });
      } else if (!shouldOpen && this.checkinOverlayRef) {
        this.checkinOverlayRef.dispose();
        this.checkinOverlayRef = null;
      }
    });
  }

  ngOnInit(): void {
    this.service.loadToday();
    this.service.loadCheckin();
  }

  // ── Daily check-in popup ──────────────────────────────────────────────────
  openCheckin(): void {
    this.checkinOpen.set(true);
  }

  closeCheckin(): void {
    this.checkinOverlayRef?.dispose();
    this.checkinOverlayRef = null;
    this.checkinOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onCheckinEsc(): void {
    if (this.checkinOpen()) this.closeCheckin();
  }

  // ── Tab switching ────────────────────────────────────────────────────────
  showToday(): void {
    this.tab.set('today');
  }

  showHistory(): void {
    this.tab.set('history');
    if (!this.historyLoaded) {
      this.historyLoaded = true;
      const to = isoDate(new Date());
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 56);
      this.service.loadHistory({ from: isoDate(fromDate), to, pageSize: 60 });
    }
  }

  /** No item write may go out when the day is locked OR the coach disabled trainee editing. */
  readonly writesLocked = computed(() => this.closed() || this.editingDisabled());

  // ── Today item interactions ────────────────────────────────────────────────
  async toggle(item: ItemView): Promise<void> {
    if (this.writesLocked()) return;
    const next = nextToggleStatus({ status: item.status.toLowerCase(), isPlanned: item.isPlanned });
    await this.run(() => this.service.setStatus(item.id, next));
  }

  async skip(item: ItemView): Promise<void> {
    if (this.writesLocked()) return;
    await this.run(() => this.service.setStatus(item.id, 'skipped'));
  }

  async remove(item: ItemView): Promise<void> {
    if (this.writesLocked()) return;
    await this.run(() => this.service.removeItem(item.id));
  }

  isAdhoc(item: ItemView): boolean {
    return !item.isPlanned;
  }

  canRemove(item: ItemView): boolean {
    return !item.isPlanned && !this.writesLocked();
  }

  // ── Off-plan add / substitute (food picker) ────────────────────────────────
  openPicker(): void {
    if (this.writesLocked()) return;
    this.substituteFor.set(null);
    this.pickerOpen.set(true);
  }

  /** Open the picker to swap a planned item for a different food. */
  substitute(item: ItemView): void {
    if (this.writesLocked() || !item.isPlanned) return;
    this.substituteFor.set(item);
    this.pickerOpen.set(true);
  }

  canSubstitute(item: ItemView): boolean {
    return item.isPlanned && !this.writesLocked() && item.status !== 'Skipped';
  }

  closePicker(): void {
    this.pickerOpen.set(false);
    this.substituteFor.set(null);
  }

  pickerLabel(): string | null {
    const target = this.substituteFor();
    return target ? `Swap for ${target.name}` : null;
  }

  /** Substitute swaps for a catalog food only; an off-plan add allows inline custom + a meal slot. */
  pickerMode(): 'offplan' | 'substitute' {
    return this.substituteFor() ? 'substitute' : 'offplan';
  }

  async onFoodAdded(payload: FoodPickerAddPayload): Promise<void> {
    const target = this.substituteFor();
    if (target) {
      await this.run(() => this.service.substitute(target.id, payload.food, payload.quantity), 'Item swapped');
      this.pickerOpen.set(false);
      this.substituteFor.set(null);
      return;
    }
    // Off-plan add — pass the chosen "Log under" slot through to the service (defaults to Off-plan).
    await this.run(() => this.service.addOffPlan(payload.food, payload.quantity, payload.mealName ?? undefined));
    if (!payload.addAnother) this.pickerOpen.set(false);
  }

  // ── Check-in ──────────────────────────────────────────────────────────────
  async saveWeight(): Promise<void> {
    const value = parsePositive(this.checkinForm.controls.weight.value);
    if (value == null) {
      this.messageService.add({ severity: 'warn', summary: 'Enter a weight in kg.' });
      return;
    }
    await this.run(() => this.service.logWeight(value), 'Weight logged');
    this.checkinForm.controls.weight.reset('');
  }

  async saveSleep(): Promise<void> {
    const value = parsePositive(this.checkinForm.controls.sleep.value);
    if (value == null) {
      this.messageService.add({ severity: 'warn', summary: 'Enter sleep hours.' });
      return;
    }
    await this.run(() => this.service.logSleep(value), 'Sleep logged');
    this.checkinForm.controls.sleep.reset('');
  }

  // ── History ─────────────────────────────────────────────────────────────────
  openDay(day: DailyNutritionLogSummaryDto): void {
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.selectedDay.set(null);
    this.service
      .getDay(day.localDate)
      .then((detail) => {
        this.selectedDay.set(detail);
        this.detailLoading.set(false);
      })
      .catch(() => {
        this.detailLoading.set(false);
        this.detailOpen.set(false);
        this.messageService.add({ severity: 'error', summary: 'Could not load day details' });
      });
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedDay.set(null);
  }

  // ── History presentation helpers ───────────────────────────────────────────
  dayLabel(day: DailyNutritionLogSummaryDto): string {
    return relativeDayLabel(day.localDate);
  }

  adherenceLabel(day: DailyNutritionLogSummaryDto): string {
    return day.plannedCount > 0 ? `${clampAdherencePct(day.adherencePct)}%` : 'No plan';
  }

  dayTone(day: DailyNutritionLogSummaryDto): AdherenceTone {
    return adherenceTone(clampAdherencePct(day.adherencePct), day.plannedCount);
  }

  dayCompletion(day: DailyNutritionLogSummaryDto): string {
    if (day.plannedCount <= 0) return 'Off-plan day';
    return `${day.completedCount}/${day.plannedCount} completed`;
  }

  trackByDate(_i: number, day: DailyNutritionLogSummaryDto): string {
    return day.localDate;
  }

  trackMeal(_i: number, meal: MealView): string {
    return meal.name;
  }

  trackItem(_i: number, item: ItemView): string {
    return item.id;
  }

  // ── Item icon/label for the control + chip ───────────────────────────────
  statusClass(status: LoggedItemStatusLabel): string {
    return status.toLowerCase();
  }

  statusIcon(status: LoggedItemStatusLabel): string {
    switch (status) {
      case 'Completed':
        return 'pi pi-check';
      case 'Substituted':
        return 'pi pi-sync';
      case 'Skipped':
        return 'pi pi-minus';
      case 'Missed':
        return 'pi pi-flag';
      default:
        return 'pi pi-circle';
    }
  }

  retryToday(): void {
    this.service.loadToday();
  }

  // ── Internals ─────────────────────────────────────────────────────────────
  private toMealView(meal: LoggedMealDto): MealView {
    return {
      name: meal.name,
      time: scheduledTimeToInput(meal.scheduledTime),
      items: meal.items.map((i) => this.toItemView(i))
    };
  }

  private toItemView(item: LoggedItemDto): ItemView {
    const macros = formatMacroLine(
      scaleMacros(
        {
          energyKcal: item.energyKcal,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          fiberG: item.fiberG
        },
        item.quantity
      )
    );
    const qty = item.quantity === 1 ? item.servingLabel : `${item.servingLabel} ×${item.quantity}`;
    return {
      id: item.id,
      name: item.foodName,
      detail: macros ? `${qty} · ${macros}` : qty,
      status: loggedItemStatusToLabel(item.status),
      isPlanned: item.isPlanned,
      kind: item.kind
    };
  }

  private async run(action: () => Promise<void>, successSummary?: string): Promise<void> {
    try {
      await action();
      if (successSummary) this.messageService.add({ severity: 'success', summary: successSummary });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: err instanceof Error ? err.message : 'Could not save your change.'
      });
    }
  }
}

function parsePositive(v: string): number | null {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole numbers render bare, fractions to one decimal (mirrors the macro-line formatter). */
function fmtMacro(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}
