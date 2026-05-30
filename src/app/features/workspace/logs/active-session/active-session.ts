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
  SessionSnapshotSetDto
} from '../session.model';

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

  readonly totalSets = computed(() => {
    const performed = this.exercises().reduce((sum, ex) => sum + ex.sets.length, 0);
    const planned = this.snapshotExercises().reduce((sum, e) => sum + (e.sets?.length ?? 0), 0);
    return Math.max(performed, planned);
  });

  readonly completedSets = computed(() =>
    this.exercises().reduce((sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length, 0)
  );

  readonly totalVolumeKg = computed(() =>
    this.exercises().reduce(
      (sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0), 0),
      0
    )
  );

  readonly avgRpe = computed(() => {
    const rpes: number[] = [];
    for (const ex of this.exercises()) {
      for (const set of ex.sets) if (set.rpe != null) rpes.push(set.rpe);
    }
    if (rpes.length === 0) return null;
    return Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10;
  });

  readonly progressPercent = computed(() => {
    const total = this.totalSets();
    return total > 0 ? Math.round((this.completedSets() / total) * 100) : 0;
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
    const snap = this.snapshotForExercise(ex);
    const planned = snap?.sets?.length ?? 0;
    const total = Math.max(planned, ex.sets.length, 1);
    const isActive = ex.id === this.activeExercise()?.id;
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
    const snap = this.snapshotForExercise(ex);
    const planned = snap?.sets?.length ?? ex.sets.length;
    const done = ex.sets.filter((s) => s.isCompleted).length;
    const progress = `${done}/${planned || ex.sets.length} sets`;
    return eq ? `${eq} · ${progress}` : progress;
  }

  snapshotForExercise(ex: PerformedExerciseDto): SessionSnapshotExerciseDto | undefined {
    return this.snapshotExercises().find((s) => s.exerciseId === ex.exerciseId);
  }

  isExerciseComplete(ex: PerformedExerciseDto): boolean {
    const snap = this.snapshotForExercise(ex);
    const planned = snap?.sets?.length ?? ex.sets.length;
    if (planned === 0) return false;
    return ex.sets.filter((s) => s.isCompleted).length >= planned;
  }

  formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const m = String(mins).padStart(2, '0');
    const s = String(secs).padStart(2, '0');
    return hrs > 0 ? `${hrs}:${m}:${s}` : `${m}:${s}`;
  }

  formatRest(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/workspace/logs']);
      return;
    }

    if (this.catalogExercises().length === 0) this.exerciseService.load('', 200);

    this.sessionService
      .getActive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (active) => {
          if (active && active.sessionId === id) this.applySession(active);
          else this.loadFromDetail(id);
        },
        error: () => this.loadFromDetail(id)
      });

    this.startTimer();
  }

  ngOnDestroy(): void {
    if (this.timerHandle) clearInterval(this.timerHandle);
  }

  private loadFromDetail(id: string): void {
    this.sessionService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
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
    if (!Number.isNaN(startMs)) {
      this.elapsedSeconds.set(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }
    // Land on the first not-yet-complete exercise, else the first.
    const firstIncomplete = s.exercises.find((e) => !this.isExerciseComplete(e));
    this.activeExerciseId.set(firstIncomplete?.id ?? s.exercises[0]?.id ?? null);
    this.seedFormFromTargets();
  }

  private startTimer(): void {
    this.timerHandle = setInterval(() => {
      if (!this.isPaused()) this.elapsedSeconds.update((v) => v + 1);
      if (this.resting()) {
        this.restRemaining.update((v) => Math.max(0, v - 1));
        if (this.restRemaining() === 0) this.resting.set(false);
      }
    }, 1000);
  }

  // ── Navigation / chrome actions ──────────────────────────────────────
  togglePause(): void {
    this.isPaused.update((v) => !v);
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
          this.session.update((s) =>
            s
              ? {
                  ...s,
                  exercises: s.exercises.map((e) =>
                    e.id === ex.id ? { ...e, sets: [...e.sets, loggedSet] } : e
                  )
                }
              : s
          );
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
          this.session.update((s) =>
            s
              ? {
                  ...s,
                  exercises: s.exercises.map((e) =>
                    e.id === ex.id ? { ...e, sets: e.sets.filter((x) => x.id !== set.id) } : e
                  )
                }
              : s
          );
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
    this.sessionService
      .addExercise(session.sessionId, {
        exerciseId: payload.exerciseId,
        planWorkoutExerciseId: null,
        order
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          const enriched: PerformedExerciseDto = {
            ...created,
            exerciseName: created.exerciseName || matched?.name || 'Exercise'
          };
          this.session.update((s) =>
            s ? { ...s, exercises: [...s.exercises, enriched] } : s
          );
          this.setActive(enriched.id);
          if (!payload.addAnother) this.pickerOpen.set(false);
        },
        error: () =>
          this.messageService.add({ severity: 'error', summary: 'Could not add exercise' })
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
    this.saving.set(true);
    this.sessionService
      .complete(session.sessionId, {
        completedAt: new Date().toISOString(),
        rpeOverall: this.avgRpe()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showFinishConfirm.set(false);
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
