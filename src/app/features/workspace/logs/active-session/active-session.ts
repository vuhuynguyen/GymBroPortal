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
  hasRequiredMetric,
  requiredMetricMessage,
  trackingProfile,
  type TrackingMetric
} from '../../../exercises/exercise-tracking';
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
  | { kind: 'done'; setNumber: number; set: PerformedSetDto; lastTime: string; restAfter: number | null }
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
  /** Wall-clock seconds rested since the last set was logged — auto-captured as the next set's restSeconds. */
  readonly restElapsed = signal(0);
  /** When the current rest period began (wall-clock); null until a set is logged, reset when the next set logs. */
  private restStartedAtMs: number | null = null;

  // Replace / add exercise picker (reuses ExercisePickerPanelComponent)
  readonly pickerOpen = signal(false);
  readonly pickerMode = signal<PickerMode>('add');

  readonly catalogExercises = this.exerciseService.exercises;

  /**
   * Active-row entry form. Carries every tracking metric; which controls are shown is driven by the active
   * exercise's mode (see {@link activeProfile} / {@link showField}). RPE is a string for `app-select`.
   */
  readonly setForm = this.fb.group({
    weightKg: this.fb.control<number | null>(null),
    reps: this.fb.control<number | null>(null, [Validators.min(0)]),
    durationSeconds: this.fb.control<number | null>(null, [Validators.min(0)]),
    distanceM: this.fb.control<number | null>(null, [Validators.min(0)]),
    calories: this.fb.control<number | null>(null, [Validators.min(0)]),
    avgHeartRate: this.fb.control<number | null>(null, [Validators.min(0)]),
    rounds: this.fb.control<number | null>(null, [Validators.min(0)]),
    // Actual rest taken before this set — auto-filled from the rest timer, editable.
    restSeconds: this.fb.control<number | null>(null, [Validators.min(0)]),
    rpe: this.fb.control<string | null>(null)
  });

  // RPE is stored server-side as an integer (1–10), so only whole-number options are offered.
  readonly rpeOptions = ['5', '6', '7', '8', '9', '10'];

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

  /** Tracking profile for the active exercise — drives which set-entry inputs the row shows. */
  readonly activeProfile = computed(() => trackingProfile(this.activeExercise()?.trackingType));

  /** Reveals the secondary metric inputs (calories / HR / rest / RPE) for the current entry. */
  readonly showMoreMetrics = signal(false);

  /** True when the active exercise's mode shows the given metric as a default (always-on) input. */
  showField(metric: TrackingMetric): boolean {
    return this.activeProfile().fields.includes(metric);
  }

  /** True when the metric is a secondary one and the "More" section is expanded. */
  showExtra(metric: TrackingMetric): boolean {
    return this.showMoreMetrics() && this.activeProfile().extras.includes(metric);
  }

  toggleMoreMetrics(): void {
    this.showMoreMetrics.update((v) => !v);
  }

  /** Compact, mode-aware summary of a prescribed target row (pending sets). */
  targetSummary(target: SessionSnapshotSetDto | null | undefined): string {
    if (!target) return '—';
    const parts: string[] = [];
    if (target.targetWeightKg != null && target.targetReps != null) parts.push(`${target.targetWeightKg} kg × ${target.targetReps}`);
    else if (target.targetReps != null) parts.push(`${target.targetReps} reps`);
    if (target.targetDurationSeconds != null) parts.push(this.formatTime(target.targetDurationSeconds));
    if (target.targetDistanceM != null) parts.push(`${target.targetDistanceM} m`);
    if (target.targetRounds != null) parts.push(`${target.targetRounds} rounds`);
    if (target.targetRpe != null) parts.push(`RPE ${target.targetRpe}`);
    return parts.length ? parts.join(' · ') : '—';
  }

  /** Compact, mode-aware summary of a logged set (e.g. "60 × 8", "12:00 · 2000 m", "5 rounds"). */
  summarizeSet(set: PerformedSetDto | null | undefined): string {
    if (!set) return '—';
    const parts: string[] = [];
    // Only metrics with a real (> 0) value are shown — never "—kg × —" or "0 kcal".
    const w = set.weightKg ?? 0;
    const r = set.reps ?? 0;
    if (w > 0 && r > 0) parts.push(`${set.weightKg} × ${set.reps}`);
    else if (r > 0) parts.push(`${set.reps} reps`);
    else if (w > 0) parts.push(`${set.weightKg} kg`);
    if ((set.durationSeconds ?? 0) > 0) parts.push(formatDuration(set.durationSeconds!));
    if ((set.distanceM ?? 0) > 0) parts.push(`${set.distanceM} m`);
    if ((set.rounds ?? 0) > 0) parts.push(`${set.rounds} rounds`);
    if ((set.calories ?? 0) > 0) parts.push(`${set.calories} kcal`);
    if ((set.avgHeartRate ?? 0) > 0) parts.push(`${set.avgHeartRate} bpm`);
    return parts.length ? parts.join(' · ') : '—';
  }

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

  /** Rendered rows for the active exercise's set table: done → active → pending. Drop stages roll up into their lead. */
  readonly activeSetRows = computed<SetRowView[]>(() => {
    const ex = this.activeExercise();
    if (!ex) return [];
    const snap = this.snapshotForExercise(ex);
    const planned = snap?.sets?.length ?? 0;
    const rows: SetRowView[] = [];

    // Only lead/standalone sets get a numbered row; a drop cluster shows as one row (e.g. "6+4+3").
    const leads = ex.sets.filter((s) => !s.parentSetId);
    leads.forEach((set, i) => {
      // Rest is stored as "rest before this set"; show it as the rest taken *after* a set
      // (= the next set's stored value), so the first set isn't mislabelled. Last set shows none.
      const next = leads[i + 1] ?? null;
      rows.push({
        kind: 'done',
        setNumber: i + 1,
        set,
        // "Last time" is only meaningful on the upcoming (active) row — keep done rows uncluttered.
        lastTime: '',
        restAfter: next?.restSeconds ?? null
      });
    });

    const activeNumber = leads.length + 1;
    const lastDone = leads[leads.length - 1] ?? null;
    rows.push({
      kind: 'active',
      setNumber: activeNumber,
      lastTime: this.rollupSummary(ex, lastDone)
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

  /** Drop stages logged under a lead set, in order. */
  dropStagesOf(ex: PerformedExerciseDto, lead: PerformedSetDto): PerformedSetDto[] {
    return ex.sets.filter((s) => s.parentSetId === lead.id);
  }

  /** Summary of a lead set rolled up with its drop stages, e.g. "60 × 6+4+3" or "12:00 · 2000 m". */
  rollupSummary(ex: PerformedExerciseDto, lead: PerformedSetDto | null | undefined): string {
    if (!lead) return '—';
    const stages = this.dropStagesOf(ex, lead);
    if (stages.length === 0) return this.summarizeSet(lead);
    // Drop cluster: show the (shared) weight once and chain the reps.
    const repsChain = [lead, ...stages].map((s) => s.reps ?? '—').join('+');
    return lead.weightKg != null ? `${lead.weightKg} × ${repsChain}` : `${repsChain} reps`;
  }

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
    if (last) return `Last set ${this.summarizeSet(last)}`;
    const snap = this.snapshotForExercise(ex);
    const target = snap?.sets?.[0];
    if (target) {
      const t: string[] = [];
      if (target.targetWeightKg != null && target.targetReps != null) t.push(`${target.targetWeightKg} kg × ${target.targetReps}`);
      else if (target.targetReps != null) t.push(`${target.targetReps} reps`);
      if (target.targetDurationSeconds != null) t.push(this.formatTime(target.targetDurationSeconds));
      if (target.targetDistanceM != null) t.push(`${target.targetDistanceM} m`);
      if (target.targetRounds != null) t.push(`${target.targetRounds} rounds`);
      if (t.length) return `Target ${t.join(' · ')}`;
    }
    return null;
  }

  exerciseStatusKind(ex: PerformedExerciseDto): 'done' | 'active' | 'pending' {
    if (ex.id === this.activeExercise()?.id) return 'active';
    return this.isExerciseComplete(ex) ? 'done' : 'pending';
  }

  /** Set-progress dots for an outline row. */
  /** Number of logged lead/standalone sets (drop stages roll up, so they don't add to the count). */
  private leadCount(ex: PerformedExerciseDto): number {
    return ex.sets.filter((s) => !s.parentSetId).length;
  }

  outlineDots(ex: PerformedExerciseDto): Array<'done' | 'active' | ''> {
    const isActive = ex.id === this.activeExercise()?.id;
    const total = this.targetSetCountForExercise(ex, isActive);
    const done = this.leadCount(ex);
    const dots: Array<'done' | 'active' | ''> = [];
    for (let i = 0; i < total; i++) {
      if (i < done) dots.push('done');
      else if (i === done && isActive) dots.push('active');
      else dots.push('');
    }
    return dots;
  }

  outlineMeta(ex: PerformedExerciseDto): string {
    const eq = this.exerciseEquipment(ex);
    const isActive = ex.id === this.activeExercise()?.id;
    const total = this.targetSetCountForExercise(ex, isActive);
    const done = this.leadCount(ex);
    const progress = `${done}/${total} sets`;
    return eq ? `${eq} · ${progress}` : progress;
  }

  snapshotForExercise(ex: PerformedExerciseDto): SessionSnapshotExerciseDto | undefined {
    return this.snapshotExercises().find((s) => s.exerciseId === ex.exerciseId);
  }

  /** Planned sets, logged sets, or the in-progress entry row — whichever is highest. */
  private targetSetCountForExercise(ex: PerformedExerciseDto, includeActiveRow: boolean): number {
    const snap = this.snapshotForExercise(ex);
    return resolveTargetSetCount(this.leadCount(ex), snap?.sets?.length ?? 0, includeActiveRow);
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
      if (this.restStartedAtMs != null) {
        this.restElapsed.set(Math.round((Date.now() - this.restStartedAtMs) / 1000));
      }
      if (this.resting()) {
        this.restRemaining.update((v) => Math.max(0, v - 1));
        if (this.restRemaining() === 0) this.resting.set(false);
      }
    }, 1000);
  }

  /** API serializes SessionStatus as camelCase (`inProgress`/`completed`/`abandoned`). */
  private normalizeStatus(status: ActiveSessionDto['status'] | string | null | undefined): SessionStatus {
    const s = String(status ?? '').toLowerCase();
    if (s === 'inprogress') return 'InProgress';
    if (s === 'abandoned') return 'Abandoned';
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
    this.showMoreMetrics.set(false);
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
    const target = snap?.sets?.[this.leadCount(ex)];
    this.setForm.reset({
      weightKg: last?.weightKg ?? target?.targetWeightKg ?? null,
      reps: last?.reps ?? target?.targetReps ?? null,
      durationSeconds: last?.durationSeconds ?? target?.targetDurationSeconds ?? null,
      distanceM: last?.distanceM ?? target?.targetDistanceM ?? null,
      calories: last?.calories ?? null,
      avgHeartRate: last?.avgHeartRate ?? null,
      rounds: last?.rounds ?? target?.targetRounds ?? null,
      // Left blank → the actual rest taken (restElapsed) is auto-captured; a typed value overrides it.
      restSeconds: null,
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
    this.doLogSet(null);
  }

  /** Log a drop/rest-pause stage onto the active exercise's last lead set (the cluster stays one logical set). */
  logDropStage(): void {
    const ex = this.activeExercise();
    if (!ex) return;
    const lead = this.lastLeadSet(ex);
    if (!lead) {
      this.messageService.add({ severity: 'warn', summary: 'Log a set first, then add a drop' });
      return;
    }
    this.doLogSet(lead.id);
  }

  /** The last logged parentless (lead/standalone) set of an exercise — the anchor for a new drop stage. */
  lastLeadSet(ex: PerformedExerciseDto): PerformedSetDto | null {
    for (let i = ex.sets.length - 1; i >= 0; i--) {
      if (!ex.sets[i].parentSetId) return ex.sets[i];
    }
    return null;
  }

  /** Exercises performed together as a superset (same group id), ordered; just [ex] when standalone. */
  supersetPeers(ex: PerformedExerciseDto): PerformedExerciseDto[] {
    if (!ex.supersetGroupId) return [ex];
    return this.exercises()
      .filter((e) => e.supersetGroupId === ex.supersetGroupId)
      .sort((a, b) => a.order - b.order);
  }

  private doLogSet(parentSetId: string | null): void {
    if (this.saving()) return;
    const session = this.session();
    const ex = this.activeExercise();
    if (!session || !ex) return;

    // Only log the metrics this exercise's mode actually uses, so a Timed set never carries a stray
    // reps/weight (and a strength set never carries duration). RPE + rest apply to every mode.
    const profile = trackingProfile(ex.trackingType);
    const loggable = new Set<string>([...profile.fields, ...profile.extras]);
    const gate = (metric: string, v: number | null) => (loggable.has(metric) ? v : null);

    const reps = gate('reps', this.toNumber(this.setForm.controls.reps.value));
    const weightKg = gate('weight', this.toNumber(this.setForm.controls.weightKg.value));
    const durationSeconds = gate('duration', this.toNumber(this.setForm.controls.durationSeconds.value));
    const distanceM = gate('distance', this.toNumber(this.setForm.controls.distanceM.value));
    const calories = gate('calories', this.toNumber(this.setForm.controls.calories.value));
    const avgHeartRate = gate('heartRate', this.toNumber(this.setForm.controls.avgHeartRate.value));
    const rounds = gate('rounds', this.toNumber(this.setForm.controls.rounds.value));
    const rpe = this.toNumber(this.setForm.controls.rpe.value);

    // Mode-aware required-metric check (mirrors the server). Strength needs reps; cardio needs
    // duration/distance; HIIT needs rounds/duration; mobility accepts a marked-done set.
    if (!hasRequiredMetric(ex.trackingType, { reps, weightKg, durationSeconds, distanceM, rounds, isCompleted: true })) {
      this.messageService.add({ severity: 'warn', summary: requiredMetricMessage(ex.trackingType) });
      return;
    }

    // Rest is captured only on a lead set (a drop stage is part of the same set, no inter-stage rest).
    // A typed value overrides the auto-captured actual rest taken since the previous set.
    const restOverride = this.toNumber(this.setForm.controls.restSeconds.value);
    const restSeconds = parentSetId
      ? null
      : restOverride ?? (this.restStartedAtMs != null ? this.restElapsed() : null);

    const setNumber = ex.sets.length + 1;
    const snap = this.snapshotForExercise(ex);
    const snapSet = parentSetId ? undefined : snap?.sets?.[setNumber - 1];

    this.saving.set(true);
    this.sessionService
      .logSet(session.sessionId, ex.id, {
        planSetId: snapSet?.planSetId ?? null,
        parentSetId,
        setNumber,
        setType: parentSetId ? 'drop' : snapSet?.setType ?? 'working',
        reps,
        weightKg,
        durationSeconds,
        distanceM,
        calories,
        avgHeartRate,
        rounds,
        rpe,
        restSeconds,
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
          this.restStartedAtMs = null; // rest captured; restart counting only when a rest period begins
          if (parentSetId) {
            // A drop stage continues the same set — no rest timer, no superset rotation.
            this.seedFormFromTargets();
            return;
          }
          this.advanceAfterSet(ex, snapSet?.restSeconds ?? DEFAULT_REST_SECONDS, setNumber + 1);
        },
        error: () => {
          this.saving.set(false);
          this.messageService.add({ severity: 'error', summary: 'Could not log set' });
        }
      });
  }

  /**
   * Superset-aware progression after a logged set: rotate to the next peer in the group; rest only fires
   * after the round completes (wraps to the first peer). A standalone exercise just rests as usual.
   */
  private advanceAfterSet(ex: PerformedExerciseDto, restSeconds: number, nextSet: number): void {
    const peers = this.supersetPeers(ex);
    if (peers.length > 1) {
      const idx = peers.findIndex((p) => p.id === ex.id);
      const next = peers[(idx + 1) % peers.length];
      this.activeExerciseId.set(next.id);
      if (next.id === peers[0].id) {
        // Wrapped back to the start → a round is complete: rest, then resume on the first peer.
        this.startRest(restSeconds, nextSet);
      } else {
        // Still mid-round → move straight to the next exercise, no rest.
        this.resting.set(false);
      }
      this.seedFormFromTargets();
      return;
    }
    this.startRest(restSeconds, nextSet);
    this.seedFormFromTargets();
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
    // Begin counting actual rest taken (wall-clock) so the next set logs how long you really rested.
    this.restStartedAtMs = Date.now();
    this.restElapsed.set(0);
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
              durationSeconds: firstSet.targetDurationSeconds ?? null,
              distanceM: firstSet.targetDistanceM ?? null,
              rounds: firstSet.targetRounds ?? null,
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
    // Nothing logged → there's no workout to complete; save it as abandoned instead.
    if (this.loggedSets() === 0) {
      this.showFinishConfirm.set(false);
      this.saving.set(true);
      this.sessionService
        .abandon(session.sessionId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.stopTimer();
            this.messageService.add({ severity: 'info', summary: 'Nothing logged — session discarded' });
            void this.router.navigate(['/workspace/logs']);
          },
          error: () => {
            this.saving.set(false);
            this.messageService.add({ severity: 'error', summary: 'Could not finish session' });
          }
        });
      return;
    }
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
