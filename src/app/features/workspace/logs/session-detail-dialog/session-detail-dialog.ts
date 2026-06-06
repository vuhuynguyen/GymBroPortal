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
import { CommonModule, DOCUMENT } from '@angular/common';
import { ButtonComponent } from '../../../../shared/ui';
import type {
  PerformedExerciseDto,
  PerformedSetDto,
  SessionDetailDto,
  SetType
} from '../session.model';

interface SetRow extends PerformedSetDto {
  isTop: boolean;
}
interface ExerciseRow {
  id: string;
  name: string;
  index: number;
  workingCount: number;
  hasPr: boolean;
  sets: SetRow[];
}

/**
 * Session detail — centered modal over a scrim (Portal variant of the v4 SessionDetail).
 * Stat strip · PR banner(s) · per-exercise sets table. Scrim-click and Esc close.
 * Weights/volume display in kg to match the Portal's stored unit (design mocks used lb).
 */
@Component({
  selector: 'app-session-detail-dialog',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './session-detail-dialog.html',
  styleUrl: './session-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SessionDetailDialogComponent implements AfterViewInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);

  readonly detail = input<SessionDetailDto | null>(null);
  readonly loading = input(false);
  readonly titleFallback = input('Workout');

  readonly closed = output<void>();
  readonly repeat = output<SessionDetailDto>();

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
    const name = this.detail()?.workoutNameSnapshot?.trim();
    if (name) return name;
    return this.isAdhoc() ? 'Ad-hoc workout' : this.titleFallback();
  });

  readonly isAdhoc = computed(() => String(this.detail()?.source ?? '').toLowerCase() === 'adhoc');

  readonly isAbandoned = computed(() => this.normalize(this.detail()?.status) === 'Abandoned');

  readonly sourceTag = computed(() => {
    const d = this.detail();
    if (!d || this.isAdhoc()) return 'Ad-hoc';
    return d.programName?.trim() || d.workoutNameSnapshot?.trim() || 'Plan';
  });

  readonly contextTag = computed(() => {
    const d = this.detail();
    if (!d || this.isAdhoc()) return null;
    const parts: string[] = [];
    if (d.planWeek != null) parts.push(`Wk ${d.planWeek}`);
    if (d.workoutNameSnapshot?.trim()) parts.push(d.workoutNameSnapshot.trim());
    return parts.length ? parts.join(' · ') : null;
  });

  readonly dateLine = computed(() => {
    const d = this.detail();
    if (!d) return '';
    const date = new Date(d.startedAt);
    if (Number.isNaN(date.getTime())) return '';
    const day = date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${day} · ${time}`;
  });

  readonly avgRpe = computed(() => {
    const rpes = (this.detail()?.exercises ?? [])
      .flatMap((e) => e.sets)
      .map((s) => s.rpe)
      .filter((r): r is number => r != null);
    if (this.detail()?.rpeOverall != null) return this.detail()!.rpeOverall!;
    if (!rpes.length) return null;
    return Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10;
  });

  readonly totalSets = computed(() =>
    (this.detail()?.exercises ?? []).reduce((sum, e) => sum + e.sets.length, 0)
  );

  /**
   * Stat strip tiles. Core metrics (duration/volume/sets) always show; optional ones (avg RPE,
   * bodyweight) are omitted when absent rather than shown as "—" (the Portal's no-dash rule),
   * which also avoids a dangling empty grid cell on narrow screens.
   */
  readonly statTiles = computed(() => {
    const d = this.detail();
    if (!d) return [] as { value: string; label: string }[];
    const tiles: { value: string; label: string }[] = [
      { value: d.durationSeconds ? `${Math.round(d.durationSeconds / 60)}m` : '0m', label: 'Duration' },
      { value: `${this.totalSets()}`, label: 'Sets' }
    ];
    // Volume (tonnage) only makes sense for weighted work — hide it for cardio/bodyweight sessions.
    if (d.totalVolumeKg > 0) tiles.splice(1, 0, { value: this.fmtNum(d.totalVolumeKg), label: 'Volume kg' });
    if (this.avgRpe() != null) tiles.push({ value: `${this.avgRpe()}`, label: 'Avg RPE' });
    if (d.bodyweightKg != null) tiles.push({ value: `${d.bodyweightKg}`, label: 'BW kg' });
    return tiles;
  });

  private fmtNum(n: number): string {
    return Number.isInteger(n) ? `${n}` : n.toFixed(1);
  }

  readonly exerciseRows = computed<ExerciseRow[]>(() => {
    const exercises = this.detail()?.exercises ?? [];
    return [...exercises]
      .sort((a, b) => a.order - b.order)
      .map((ex, i) => this.toExerciseRow(ex, i));
  });

  private toExerciseRow(ex: PerformedExerciseDto, i: number): ExerciseRow {
    const sets = [...ex.sets].sort((a, b) => a.setNumber - b.setNumber);
    const working = sets.filter((s) => this.isWorking(s.setType));
    const topE1rm = Math.max(0, ...working.map((s) => s.estimatedOneRepMaxKg ?? 0));
    // The single best working set (first one reaching the max e1RM), excluding a PR set.
    const topSetId =
      topE1rm > 0
        ? working.find((s) => !s.isPr && (s.estimatedOneRepMaxKg ?? 0) === topE1rm)?.id ?? null
        : null;
    return {
      id: ex.id,
      name: ex.exerciseName ?? 'Exercise',
      index: i + 1,
      workingCount: working.length,
      hasPr: sets.some((s) => s.isPr),
      sets: sets.map((s) => ({
        ...s,
        isTop: s.id === topSetId
      }))
    };
  }

  /** API serializes enums as camelCase (`working`, `amrap`…), so compare case-insensitively. */
  private isWorking(type: SetType | string): boolean {
    return String(type).toLowerCase() === 'working';
  }

  isWarmup(type: SetType | string): boolean {
    return String(type).toLowerCase() === 'warmup';
  }

  setTypeClass(type: SetType | string): string {
    switch (String(type).toLowerCase()) {
      case 'working':
        return 'work';
      case 'amrap':
        return 'amrap';
      case 'drop':
        return 'drop';
      default:
        return '';
    }
  }

  setTypeLabel(type: SetType | string): string {
    const t = String(type).toLowerCase();
    if (t === 'amrap') return 'AMRAP';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  weightReps(set: PerformedSetDto): string {
    if (set.reps != null) {
      if (set.weightKg && set.weightKg > 0) return `${set.weightKg} × ${set.reps}`;
      return `BW × ${set.reps}`;
    }
    // Cardio / timed / distance sets carry no reps.
    if (set.durationSeconds) return this.formatSetDuration(set.durationSeconds);
    if (set.distanceM) return `${set.distanceM} m`;
    return 'Not set';
  }

  private formatSetDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  }

  onRepeat(): void {
    const d = this.detail();
    if (d) this.repeat.emit(d);
  }

  private normalize(status: string | null | undefined): string {
    const s = String(status ?? '').toLowerCase();
    if (s === 'abandoned') return 'Abandoned';
    if (s === 'inprogress' || s === 'in_progress' || s === 'in progress') return 'InProgress';
    return 'Completed';
  }
}
