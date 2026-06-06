import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, map, switchMap } from 'rxjs/operators';
import { catchError, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import {
  ButtonComponent,
  ConfirmSplitDialogComponent,
  PageContainerComponent,
  PageHeaderComponent,
  PanelCardComponent,
  SelectComponent
} from '../../../../shared/ui';
import { ExerciseService } from '../../../exercises/exercise';
import type { ExerciseDto } from '../../../exercises/exercise.model';
import {
  ExercisePickerPanelComponent,
  type ExercisePickerAddPayload
} from '../../plans/exercise-picker-panel/exercise-picker-panel';
import { SessionService } from '../session.service';
import type {
  ActiveSessionDto,
  PerformedExerciseDto,
  PerformedSetDto,
  SessionSnapshotExerciseDto,
  SessionSnapshotSetDto,
  SessionStatus
} from '../session.model';
import {
  averageCompletedRpe,
  computeElapsedSeconds,
  computeProgressPercent,
  countLoggedSets,
  formatDuration,
  formatRestClock,
  isPerformedExerciseComplete,
  resolveTargetSetCount,
  sumCompletedVolumeKg
} from './session-metrics';

/** One rendered row in the active exercise's set table. */
type SetRowView =
  | { kind: 'done'; setNumber: number; set: PerformedSetDto; lastTime: string }
  | { kind: 'active'; setNumber: number; lastTime: string }
  | { kind: 'pending'; setNumber: number; target: SessionSnapshotSetDto | null; lastTime: string };

/** Side-panel mode for the replace / add exercise overlay. */
type PickerMode = 'replace' | 'add';

const DEFAULT_REST_SECONDS = 90;

@Component({
  selector: 'app-active-session',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonComponent,
    ConfirmSplitDialogComponent,
    PageContainerComponent,
    PageHeaderComponent,
    PanelCardComponent,
    SelectComponent,
    ExercisePickerPanelComponent
  ],
  templateUrl: './active-session.html',
  styleUrl: './active-session.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActiveSessionComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  // ── State ────────────────────────────────────────────────────────────
  readonly session = signal<ActiveSessionDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly elapsedSeconds = signal(0);
  readonly isPaused = signal(false);
  readonly activeExerciseId = signal<string | null>(null);
  readonly showFinishConfirm = signal(false);
  readonly showAbandonConfirm = signal(false);

  // Rest banner
  readonly resting = signal(false);
  readonly restRemaining = signal(0);
  readonly restTarget = signal(DEFAULT_REST_SECONDS);
  readonly restNextSet = signal<number | null>(null);

  // Replace / add exercise picker (reuses ExercisePickerPanelComponent)
  readonly pickerOpen = signal(false);
  readonly pickerMode = signal<PickerMode>('add');

  readonly catalogExercises = this.exerciseService.exercises;

  /** Active-row entry form (weight / reps / rpe). RPE is a string for `app-select`. */
  readonly setForm = this.fb.group({
    weightKg: this.fb.control<number | null>(null),
    reps: this.fb.control<number | null>(null, [Validators.min(0)]),
    rpe: this.fb.control<string | null>(null)
  });

  readonly rpeOptions = ['5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'];

  private timerHandle: ReturnType<typeof setInterval> | null = null;
  /** Wall-clock anchor for elapsed time — reset whenever a different session loads. */
  private sessionStartMs: number | null = null;
  /** Accumulated pause time subtracted from wall-clock elapsed. */
  private pausedOffsetMs = 0;
  /** When pause began; used to extend `pausedOffsetMs` on resume. */
  private pauseStartedAtMs: number | null = null;
  /** Route session id currently being loaded — guards against stale HTTP responses. */
  private currentSessionId: string | null = null;

  // ── Derived ──────────────────────────────────────────────────────────
  readonly workoutTitle = computed(() => {
    const s = this.session();
    if (!s) return 'Session';
    return s.workoutNameSnapshot || s.snapshot?.workoutName || 'Ad-hoc workout';
  });

  readonly exercises = computed<PerformedExerciseDto[]>(() => this.session()?.exercises ?? []);

  readonly snapshotExercises = computed<SessionSnapshotExerciseDto[]>(
    () => this.session()?.snapshot?.exercises ?? []
  );

  /** Catalog lookup so we can resolve equipment / muscle for performed exercises. */
  private readonly catalogById = computed<Map<string, ExerciseDto>>(() => {
    const map = new Map<string, ExerciseDto>();
    for (const ex of this.catalogExercises()) map.set(ex.id, ex);
    return map;
  });

  readonly activeExercise = computed<PerformedExerciseDto | null>(() => {
    const list = this.exercises();
    if (list.length === 0) return null;
    return list.find((e) => e.id === this.activeExerciseId()) ?? list[0];
  });

  readonly activeIndex = computed(() => {
    const active = this.activeExercise();
    if (!active) return 0;
    return this.exercises().findIndex((e) => e.id === active.id) + 1;
  });

  readonly loggedSets = computed(() => countLoggedSets(this.exercises()));

  readonly totalSets = computed(() =>
    this.exercises().reduce((sum, ex) => {
      const isActive = ex.id === this.activeExercise()?.id;
      return sum + this.targetSetCountForExercise(ex, isActive);
    }, 0)
  );

  readonly totalVolumeKg = computed(() => sumCompletedVolumeKg(this.exercises()));

  readonly avgRpe = computed(() => averageCompletedRpe(this.exercises()));

  readonly progressPercent = computed(() =>
    computeProgressPercent(this.loggedSets(), this.totalSets())
  );

  /** KPI-friendly set counter — hides meaningless `0 / 0` before the workout has targets. */
  readonly setsKpiValue = computed(() => {
    const total = this.totalSets();
    if (total <= 0) return '—';
    return `${this.loggedSets()} / ${total}`;
  });

  /** Rendered rows for the active exercise's set table: done → active → pending. */
  readonly activeSetRows = computed<SetRowView[]>(() => {
    const ex = this.activeExercise();
    if (!ex) return [];
    const snap = this.snapshotForExercise(ex);
    const planned = snap?.sets?.length ?? 0;
    const rows: SetRowView[] = [];

    ex.sets.forEach((set, i) => {
      const prev = i > 0 ? ex.sets[i - 1] : null;
      rows.push({
        kind: 'done',
        setNumber: i + 1,
        set,
        lastTime: prev ? `${prev.weightKg ?? 0} × ${prev.reps ?? 0}` : '—'
      });
    });

    const activeNumber = ex.sets.length + 1;
    const lastDone = ex.sets[ex.sets.length - 1] ?? null;
    rows.push({
      kind: 'active',
      setNumber: activeNumber,
      lastTime: lastDone ? `${lastDone.weightKg ?? 0} × ${lastDone.reps ?? 0}` : '—'
    });

    for (let n = activeNumber + 1; n <= planned; n++) {
      rows.push({
        kind: 'pending',
        setNumber: n,
        target: snap?.sets?.[n - 1] ?? null,
        lastTime: '—'
      });
    }
    return rows;
  });

  /** Header subtitle (live status + elapsed + source) shown under the title. */
  readonly headerSubtitle = computed(() => {
    const s = this.session();
    const status = this.isPaused() ? 'Paused' : 'Live session';
    const source = s?.source === 'FromAssignment' ? 'From assigned plan' : 'Ad-hoc session';
    return `${status} · ${this.formatTime(this.elapsedSeconds())} elapsed · ${source}`;
  });

  // ── Display helpers ──────────────────────────────────────────────────
  exerciseName(ex: PerformedExerciseDto | null): string {
    if (!ex) return 'Exercise';
    if (ex.exerciseName?.trim()) return ex.exerciseName;
    const snap = this.snapshotForExercise(ex);
    if (snap?.exerciseName?.trim()) return snap.exerciseName;
    const meta = this.catalogById().get(ex.exerciseId);
    if (meta?.name?.trim()) return meta.name;
    return `Exercise ${ex.order}`;
  }

  /** Equipment label resolved from the catalog (hidden when unknown — never shows blank). */
  exerciseEquipment(ex: PerformedExerciseDto | null): string | null {
    if (!ex) return null;
    const meta = this.catalogById().get(ex.exerciseId);
    return meta?.equipment?.trim() || null;
  }

  /** Short "last set" subtitle for the active panel; falls back to the prescribed target. */
  activeExerciseSub(ex: PerformedExerciseDto | null): string | null {
    if (!ex) return null;
    const last = ex.sets[ex.sets.length - 1];
    if (last) return `Last set ${last.weightKg ?? 0} kg × ${last.reps ?? 0}`;
    const snap = this.snapshotForExercise(ex);
    const target = snap?.sets?.[0];
    if (target?.targetWeightKg != null || target?.targetReps != null) {
      const w = target?.targetWeightKg != null ? `${target.targetWeightKg} kg × ` : '';
      return `Target ${w}${target?.targetReps ?? '—'}`;
    }
    return null;
  }

  exerciseStatusKind(ex: PerformedExerciseDto): 'done' | 'active' | 'pending' {
    if (ex.id === this.activeExercise()?.id) return 'active';
    return this.isExerciseComplete(ex) ? 'done' : 'pending';
  }

  /** Set-progress dots for an outline row. */
  outlineDots(ex: PerformedExerciseDto): Array<'done' | 'active' | ''> {
    const isActive = ex.id === this.activeExercise()?.id;
    const total = this.targetSetCountForExercise(ex, isActive);
    const dots: Array<'done' | 'active' | ''> = [];
    for (let i = 0; i < total; i++) {
      if (i < ex.sets.length) dots.push('done');
      else if (i === ex.sets.length && isActive) dots.push('active');
      else dots.push('');
    }
    return dots;
  }

  outlineMeta(ex: PerformedExerciseDto): string {
    const eq = this.exerciseEquipment(ex);
    const isActive = ex.id === this.activeExercise()?.id;
    const total = this.targetSetCountForExercise(ex, isActive);
    const done = ex.sets.length;
    const progress = `${done}/${total} sets`;
    return eq ? `${eq} · ${progress}` : progress;
  }

  snapshotForExercise(ex: PerformedExerciseDto): SessionSnapshotExerciseDto | undefined {
    return this.snapshotExercises().find((s) => s.exerciseId === ex.exerciseId);
  }

  /** Planned sets, logged sets, or the in-progress entry row — whichever is highest. */
  private targetSetCountForExercise(ex: PerformedExerciseDto, includeActiveRow: boolean): number {
    const snap = this.snapshotForExercise(ex);
    return resolveTargetSetCount(ex.sets.length, snap?.sets?.length ?? 0, includeActiveRow);
  }

  isExerciseComplete(ex: PerformedExerciseDto): boolean {
    const snap = this.snapshotForExercise(ex);
    return isPerformedExerciseComplete(ex, snap?.sets?.length ?? null);
  }

  formatTime(seconds: number): string {
    return formatDuration(seconds);
  }

  formatRest(seconds: number): string {
    return formatRestClock(seconds);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────
  ngOnInit(): void {
    if (this.catalogExercises().length === 0) this.exerciseService.load('', 200);

    this.route.paramMap
      .pipe(
        map((p) => p.get('id')),
        filter((id): id is string => !!id),
        switchMap((id) => {
          this.currentSessionId = id;
          this.resetSessionState();
          this.loading.set(true);
          return this.sessionService.getActive().pipe(
            map((active) => ({ id, active })),
            catchError(() => of({ id, active: null as ActiveSessionDto | null }))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ id, active }) => {
        if (active && active.sessionId === id) {
          this.applySession(active);
        } else {
          this.loadFromDetail(id);
        }
      });

    this.startTimer();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  /** Clear UI state so a route change never carries over timer / pause / rest from a prior session. */
  private resetSessionState(): void {
    this.session.set(null);
    this.elapsedSeconds.set(0);
    this.isPaused.set(false);
    this.sessionStartMs = null;
    this.pausedOffsetMs = 0;
    this.pauseStartedAtMs = null;
    this.resting.set(false);
    this.restRemaining.set(0);
    this.restTarget.set(DEFAULT_REST_SECONDS);
    this.restNextSet.set(null);
    this.activeExerciseId.set(null);
    this.showFinishConfirm.set(false);
    this.showAbandonConfirm.set(false);
    this.pickerOpen.set(false);
  }

  private loadFromDetail(id: string): void {
    this.sessionService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (this.currentSessionId !== id) return;
          this.applySession({
            sessionId: detail.id,
            status: detail.status,
            startedAt: detail.startedAt,
            source: detail.source,
            snapshot: detail.workoutNameSnapshot
              ? { workoutName: detail.workoutNameSnapshot, exercises: [] }
              : null,
            exercises: detail.exercises,
            workoutNameSnapshot: detail.workoutNameSnapshot,
            planAssignmentId: detail.planAssignmentId
          });
        },
        error: () => {
          if (this.currentSessionId !== id) return;
          this.loading.set(false);
          this.messageService.add({ severity: 'error', summary: 'Could not load session' });
          void this.router.navigate(['/workspace/logs']);
        }
      });
  }

  private applySession(s: ActiveSessionDto): void {
    this.session.set(s);
    this.loading.set(false);

    const startMs = Date.parse(s.startedAt);
    this.sessionStartMs = Number.isNaN(startMs) ? null : startMs;
    this.pausedOffsetMs = 0;
    this.pauseStartedAtMs = null;
    this.isPaused.set(false);
    this.syncElapsed();

    const inProgress = this.normalizeStatus(s.status) === 'InProgress';
    if (inProgress) {
      this.startTimer();
    } else {
      this.stopTimer();
    }

    // Land on the first not-yet-complete exercise, else the first.
    const firstIncomplete = s.exercises.find((e) => !this.isExerciseComplete(e));
    this.activeExerciseId.set(firstIncomplete?.id ?? s.exercises[0]?.id ?? null);
    this.seedFormFromTargets();
  }

  /** Derive elapsed from session start (minus accumulated pauses) instead of blind +1 ticks. */
  private syncElapsed(): void {
    if (this.sessionStartMs == null) {
      this.elapsedSeconds.set(0);
      return;
    }
    if (this.isPaused()) return;
    this.elapsedSeconds.set(
      computeElapsedSeconds(this.sessionStartMs, Date.now(), this.pausedOffsetMs)
    );
  }

  private stopTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerHandle = setInterval(() => {
      this.syncElapsed();
      if (this.resting()) {
        this.restRemaining.update((v) => Math.max(0, v - 1));
        if (this.restRemaining() === 0) this.resting.set(false);
      }
    }, 1000);
  }

  private normalizeStatus(status: ActiveSessionDto['status'] | string | number | null | undefined): SessionStatus {
    const s = String(status ?? '').toLowerCase().replace(/[_\s]/g, '');
    if (s === 'inprogress' || s === '1') return 'InProgress';
    if (s === 'abandoned' || s === '3') return 'Abandoned';
    return 'Completed';
  }

  // ── Navigation / chrome actions ──────────────────────────────────────
  togglePause(): void {
    if (this.isPaused()) {
      if (this.pauseStartedAtMs != null) {
        this.pausedOffsetMs += Date.now() - this.pauseStartedAtMs;
        this.pauseStartedAtMs = null;
      }
      this.isPaused.set(false);
      this.syncElapsed();
    } else {
      this.pauseStartedAtMs = Date.now();
      this.isPaused.set(true);
    }
  }

  setActive(exerciseId: string): void {
    this.activeExerciseId.set(exerciseId);
    this.resting.set(false);
    this.seedFormFromTargets();
  }

  goBack(): void {
    void this.router.navigate(['/workspace/logs']);
  }

  // ── Set entry ────────────────────────────────────────────────────────
  /** Pre-fill the active row from the prescribed target or the last logged set. */
  private seedFormFromTargets(): void {
    const ex = this.activeExercise();
    if (!ex) return;
    const last = ex.sets[ex.sets.length - 1];
    const snap = this.snapshotForExercise(ex);
    const target = snap?.sets?.[ex.sets.length];
    this.setForm.reset({
      weightKg: last?.weightKg ?? target?.targetWeightKg ?? null,
      reps: last?.reps ?? target?.targetReps ?? null,
      rpe: null
    });
  }

  private toNumber(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  bumpWeight(delta: number): void {
    const current = this.toNumber(this.setForm.controls.weightKg.value) ?? 0;
    this.setForm.controls.weightKg.setValue(Math.max(0, Math.round((current + delta) * 100) / 100));
  }

  bumpReps(delta: number): void {
    const current = this.toNumber(this.setForm.controls.reps.value) ?? 0;
    this.setForm.controls.reps.setValue(Math.max(0, current + delta));
  }

  /** "Add set" affordance — primes the active entry row with the next target defaults. */
  resetActiveSet(): void {
    this.resting.set(false);
    this.seedFormFromTargets();
  }

  /**
   * Apply an in-session mutation (log/remove/add set or exercise) to the viewed session AND keep the
   * shared SessionService.activeSession signal in sync, so the logs banner reflects the change live —
   * single source of truth. Mutations only occur on the in-progress session; the status guard prevents
   * a viewed historical (completed/abandoned) session from ever being pushed into the banner signal.
   */
  private mutateSession(updater: (s: ActiveSessionDto) => ActiveSessionDto): void {
    this.session.update((s) => (s ? updater(s) : s));
    const updated = this.session();
    if (updated && this.normalizeStatus(updated.status) === 'InProgress') {
      this.sessionService.activeSession.set(updated);
    }
  }

  logSet(): void {
    if (this.saving()) return;
    const session = this.session();
    const ex = this.activeExercise();
    if (!session || !ex) return;

    const reps = this.toNumber(this.setForm.controls.reps.value);
    const weightKg = this.toNumber(this.setForm.controls.weightKg.value);
    const rpe = this.toNumber(this.setForm.controls.rpe.value);
    if (reps == null) {
      this.messageService.add({ severity: 'warn', summary: 'Enter reps to log the set' });
      return;
    }

    const setNumber = ex.sets.length + 1;
    const snap = this.snapshotForExercise(ex);
    const snapSet = snap?.sets?.[setNumber - 1];

    this.saving.set(true);
    this.sessionService
      .logSet(session.sessionId, ex.id, {
        planSetId: snapSet?.planSetId ?? null,
        setNumber,
        setType: snapSet?.setType ?? 'Working',
        reps,
        weightKg,
        rpe,
        isCompleted: true
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loggedSet) => {
          this.saving.set(false);
          this.mutateSession((s) => ({
            ...s,
            exercises: s.exercises.map((e) =>
              e.id === ex.id ? { ...e, sets: [...e.sets, loggedSet] } : e
            )
          }));
          this.startRest(snapSet?.restSeconds ?? DEFAULT_REST_SECONDS, setNumber + 1);
          this.seedFormFromTargets();
        },
        error: () => {
          this.saving.set(false);
          this.messageService.add({ severity: 'error', summary: 'Could not log set' });
        }
      });
  }

  removeSet(set: PerformedSetDto): void {
    const session = this.session();
    const ex = this.activeExercise();
    if (!session || !ex) return;
    this.sessionService
      .deleteSet(session.sessionId, ex.id, set.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.mutateSession((s) => ({
            ...s,
            exercises: s.exercises.map((e) =>
              e.id === ex.id ? { ...e, sets: e.sets.filter((x) => x.id !== set.id) } : e
            )
          }));
          this.seedFormFromTargets();
        },
        error: () =>
          this.messageService.add({ severity: 'error', summary: 'Could not delete set' })
      });
  }

  // ── Rest banner ──────────────────────────────────────────────────────
  private startRest(seconds: number, nextSet: number): void {
    this.restTarget.set(seconds);
    this.restRemaining.set(seconds);
    this.restNextSet.set(nextSet);
    this.resting.set(true);
  }

  adjustRest(delta: number): void {
    this.restRemaining.update((v) => Math.max(0, v + delta));
    this.restTarget.update((v) => Math.max(0, v + delta));
  }

  skipRest(): void {
    this.resting.set(false);
  }

  get restProgress(): number {
    const target = this.restTarget();
    if (target <= 0) return 0;
    return Math.min(100, Math.round((this.restRemaining() / target) * 100));
  }

  // ── Replace / add exercise (reuses ExercisePickerPanelComponent) ─────
  openReplace(): void {
    this.pickerMode.set('replace');
    this.ensureCatalog();
    this.pickerOpen.set(true);
  }

  openAdd(): void {
    this.pickerMode.set('add');
    this.ensureCatalog();
    this.pickerOpen.set(true);
  }

  closePicker(): void {
    this.pickerOpen.set(false);
  }

  private ensureCatalog(): void {
    if (this.catalogExercises().length === 0) this.exerciseService.load('', 200);
  }

  /**
   * Handle a pick from the shared exercise picker panel.
   * Diverges from current Portal: the API has no in-place replace endpoint, so a
   * "Replace" appends the chosen exercise as a substitute and makes it active (same as Add).
   */
  onExercisePicked(payload: ExercisePickerAddPayload): void {
    const session = this.session();
    if (!session) return;
    const order = this.exercises().length + 1;
    const matched = this.catalogExercises().find((e) => e.id === payload.exerciseId);
    const firstSet = payload.sets[0];
    this.saving.set(true);
    this.sessionService
      .addExercise(session.sessionId, {
        exerciseId: payload.exerciseId,
        planWorkoutExerciseId: null,
        order
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          const enriched: PerformedExerciseDto = {
            ...created,
            exerciseName: created.exerciseName || matched?.name || 'Exercise',
            sets: created.sets ?? []
          };
          this.mutateSession((s) => ({ ...s, exercises: [...s.exercises, enriched] }));
          this.setActive(enriched.id);
          if (firstSet) {
            this.setForm.reset({
              weightKg: firstSet.targetWeightKg,
              reps: firstSet.targetReps,
              rpe: firstSet.targetRpe != null ? String(firstSet.targetRpe) : null
            });
          } else {
            this.seedFormFromTargets();
          }
          if (!payload.addAnother) this.pickerOpen.set(false);
        },
        error: (err: { error?: { message?: string } | string }) => {
          this.saving.set(false);
          const detail =
            typeof err.error === 'string'
              ? err.error
              : err.error?.message ?? 'Could not add exercise.';
          this.messageService.add({ severity: 'error', summary: 'Could not add exercise', detail });
        }
      });
  }

  skipExercise(): void {
    // No skip endpoint yet — advance focus to the next pending exercise.
    const list = this.exercises();
    const idx = list.findIndex((e) => e.id === this.activeExercise()?.id);
    const next = list.slice(idx + 1).find((e) => !this.isExerciseComplete(e)) ?? list[idx + 1];
    if (next) {
      this.setActive(next.id);
    } else {
      this.messageService.add({ severity: 'info', summary: 'No further exercises to move to' });
    }
  }

  // ── Finish / abandon ─────────────────────────────────────────────────
  requestFinish(): void {
    this.showFinishConfirm.set(true);
  }

  onFinishOpenChange(open: boolean): void {
    if (!open) this.showFinishConfirm.set(false);
  }

  finishWorkout(): void {
    const session = this.session();
    if (!session) return;
    const avg = this.avgRpe();
    const rpeOverall =
      avg != null ? Math.min(10, Math.max(1, Math.round(avg))) : null;
    this.saving.set(true);
    this.sessionService
      .complete(session.sessionId, {
        completedAt: new Date().toISOString(),
        rpeOverall
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showFinishConfirm.set(false);
          this.stopTimer();
          this.messageService.add({ severity: 'success', summary: 'Workout completed' });
          void this.router.navigate(['/workspace/logs']);
        },
        error: () => {
          this.saving.set(false);
          this.messageService.add({ severity: 'error', summary: 'Could not complete session' });
        }
      });
  }

  requestAbandon(): void {
    this.showAbandonConfirm.set(true);
  }

  onAbandonOpenChange(open: boolean): void {
    if (!open) this.showAbandonConfirm.set(false);
  }

  abandonWorkout(): void {
    const session = this.session();
    if (!session) return;
    this.saving.set(true);
    this.sessionService
      .abandon(session.sessionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showAbandonConfirm.set(false);
          this.stopTimer();
          this.messageService.add({ severity: 'success', summary: 'Session abandoned' });
          void this.router.navigate(['/workspace/logs']);
        },
        error: () => {
          this.saving.set(false);
          this.messageService.add({ severity: 'error', summary: 'Could not abandon session' });
        }
      });
  }

  // ── trackBy ──────────────────────────────────────────────────────────
  trackExerciseById(_i: number, ex: PerformedExerciseDto): string {
    return ex.id;
  }

  trackRow(i: number, row: SetRowView): string {
    return row.kind === 'done' ? row.set.id : `${row.kind}-${row.setNumber}`;
  }
}
