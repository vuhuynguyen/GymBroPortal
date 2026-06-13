import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonComponent, PageContainerComponent } from '../../../../shared/ui';
import { TenantService } from '../../../../core/tenant/tenant';
import { SessionService } from '../../logs/session.service';
import { WorkoutPlanService } from '../../plans/workout-plan.service';
import type {
  MyAssignedPlanDto,
  PlanSetDetailDto,
  PlanSetTypeApi,
  PlanWorkoutDetailDto,
  PlanWorkoutExerciseDetailDto,
  WorkoutPlanDetailDto
} from '../../plans/workout-plan.model';

/** A redacted exercise comes back with a zeroed id and no name (HideExercises). */
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface SetVm {
  num: number;
  type: PlanSetTypeApi;
  typeLabel: string;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  restSeconds: number;
}

interface ExerciseVm {
  id: string;
  name: string;
  hidden: boolean;
  hiddenTargets: boolean;
  setSummary: string;
  sets: SetVm[];
}

interface DayVm {
  id: string;
  letter: string;
  name: string;
  locked: boolean;
  exerciseCount: number;
  setCount: number;
  exercises: ExerciseVm[];
}

interface SummaryVm {
  coach: string;
  durationWeeks: number | null;
  daysPerWeek: number | null;
  startDate: string | null;
}

interface ProgressVm {
  week: number;
  totalWeeks: number;
  percent: number;
}

interface HiddenAspect {
  icon: string;
  label: string;
}

interface ActiveSessionVm {
  sessionId: string;
  title: string;
  startedAt: string;
  elapsed: string;
}

interface RedactionFlags {
  hideExercises: boolean;
  hideSetsReps: boolean;
  lockEmpty: boolean;
}

/**
 * Read-only trainee view of an assigned plan. The backend already redacts the plan per the
 * assignment's visibility flags (Guided mode): hidden exercise names/ids and null set targets are
 * rendered as graceful placeholders here — the UI is never the visibility boundary.
 */
@Component({
  selector: 'app-plan-view',
  standalone: true,
  imports: [PageContainerComponent, ButtonComponent, DatePipe],
  templateUrl: './plan-view.html',
  styleUrl: './plan-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanViewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);
  private readonly workoutPlanService = inject(WorkoutPlanService);
  private readonly sessionService = inject(SessionService);
  private readonly messageService = inject(MessageService);

  private readonly trainerId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('trainerId') ?? ''))
  );
  private readonly planId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('planId') ?? ''))
  );

  readonly loading = signal(true);
  readonly plan = signal<WorkoutPlanDetailDto | null>(null);
  readonly assignment = signal<MyAssignedPlanDto | null>(null);
  private readonly openDayIds = signal<ReadonlySet<string>>(new Set());
  /** Ticks every second so the active-session elapsed timer stays live. */
  private readonly now = signal(Date.now());

  private lastLoadedPlanId: string | null = null;

  readonly coachName = computed(() => {
    const id = this.trainerId();
    return this.tenantService.trainerWorkspaces().find((w) => w.id === id)?.ownerName?.trim() || null;
  });

  readonly isGuided = computed(() => this.assignment()?.visibilityMode === 'Guided');

  /** The visibility options the coach switched on, surfaced as chips in the guided note. */
  readonly hiddenAspects = computed<HiddenAspect[]>(() => {
    const a = this.assignment();
    if (!a) return [];
    const aspects: HiddenAspect[] = [];
    if (a.hideExercises) aspects.push({ icon: 'pi-eye-slash', label: 'Some exercises hidden' });
    if (a.hideSetsReps) aspects.push({ icon: 'pi-eye-slash', label: 'Set targets hidden' });
    if (a.hideFutureWorkouts) aspects.push({ icon: 'pi-lock', label: 'Future workouts locked' });
    return aspects;
  });

  /** An in-progress session that belongs to this plan's assignment — drives the resume hero. */
  readonly activeSession = computed<ActiveSessionVm | null>(() => {
    const session = this.sessionService.activeSession();
    const assignmentId = this.assignment()?.id;
    if (!session || session.status !== 'InProgress') return null;
    if (!assignmentId || session.planAssignmentId !== assignmentId) return null;
    const startedMs = Date.parse(session.startedAt);
    const elapsedSec = Number.isNaN(startedMs)
      ? 0
      : Math.max(0, Math.floor((this.now() - startedMs) / 1000));
    return {
      sessionId: session.sessionId,
      title: session.workoutNameSnapshot || session.snapshot?.workoutName || 'Workout in progress',
      startedAt: session.startedAt,
      elapsed: this.formatDuration(elapsedSec)
    };
  });

  readonly summary = computed<SummaryVm>(() => {
    const p = this.plan();
    const a = this.assignment();
    return {
      coach: this.coachName() ?? 'Not set',
      durationWeeks: p?.durationWeeks ?? null,
      daysPerWeek: a?.daysPerWeek ?? p?.workoutsPerWeek ?? null,
      startDate: a?.startDate ?? null
    };
  });

  /** Current week is derived from the assignment start date and the plan length — never invented. */
  readonly progress = computed<ProgressVm | null>(() => {
    const total = this.plan()?.durationWeeks ?? null;
    const start = this.assignment()?.startDate ?? null;
    if (!total || total < 1 || !start) return null;
    const startMs = Date.parse(start);
    if (Number.isNaN(startMs)) return null;
    const elapsed = Math.floor((Date.now() - startMs) / WEEK_MS) + 1;
    const week = Math.min(Math.max(elapsed, 1), total);
    return { week, totalWeeks: total, percent: Math.round((week / total) * 100) };
  });

  readonly days = computed<DayVm[]>(() => {
    const workouts = this.plan()?.workouts ?? [];
    const a = this.assignment();
    const flags: RedactionFlags = {
      hideExercises: a?.hideExercises ?? false,
      hideSetsReps: a?.hideSetsReps ?? false,
      // An empty workout reads as "locked" when the coach hides future workouts (or, lacking the
      // explicit flag, whenever the plan is Guided).
      lockEmpty: a?.hideFutureWorkouts ?? a?.visibilityMode === 'Guided'
    };
    return [...workouts]
      .sort((x, y) => x.order - y.order)
      .map((workout, index) => this.toDayVm(workout, index, flags));
  });

  constructor() {
    effect(() => {
      const id = this.planId()?.trim() ?? '';
      if (!id || this.lastLoadedPlanId === id) return;
      this.lastLoadedPlanId = id;
      this.load(id);
    });

    const ticker = setInterval(() => {
      if (this.activeSession()) this.now.set(Date.now());
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(ticker));
  }

  private load(id: string): void {
    this.loading.set(true);
    forkJoin({
      plan: this.workoutPlanService.get(id),
      assignments: this.workoutPlanService.listMyAssignments(),
      // Populates SessionService.activeSession; 204/errors resolve to null.
      active: this.sessionService.getActive()
    }).subscribe({
      next: ({ plan, assignments }) => {
        this.plan.set(plan);
        this.assignment.set(assignments.find((a) => a.planId === id) ?? null);
        // Open the first unlocked day by default; the rest stay collapsed.
        const firstOpen = this.days().find((d) => !d.locked);
        this.openDayIds.set(firstOpen ? new Set([firstOpen.id]) : new Set());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not open plan',
          detail: 'This plan may no longer be available to you.'
        });
        this.back();
      }
    });
  }

  isDayOpen(day: DayVm): boolean {
    return this.openDayIds().has(day.id);
  }

  toggleDay(day: DayVm): void {
    if (day.locked) return;
    const next = new Set(this.openDayIds());
    if (next.has(day.id)) next.delete(day.id);
    else next.add(day.id);
    this.openDayIds.set(next);
  }

  /** Exercises start collapsed (long workouts stay scannable); this holds the ones the trainee opened. */
  private readonly openExerciseIds = signal<ReadonlySet<string>>(new Set());

  isExerciseOpen(ex: ExerciseVm): boolean {
    return this.openExerciseIds().has(ex.id);
  }

  toggleExercise(ex: ExerciseVm): void {
    const next = new Set(this.openExerciseIds());
    if (next.has(ex.id)) next.delete(ex.id);
    else next.add(ex.id);
    this.openExerciseIds.set(next);
  }

  back(): void {
    void this.router.navigate(['/workspace/trainer', this.trainerId(), 'plans']);
  }

  resumeSession(): void {
    const session = this.activeSession();
    if (!session) return;
    void this.router.navigate(['/workspace/logs/session', session.sessionId]);
  }

  private formatDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  private toDayVm(workout: PlanWorkoutDetailDto, index: number, flags: RedactionFlags): DayVm {
    const exercises = [...workout.exercises]
      .sort((a, b) => a.order - b.order)
      .map((exercise) => this.toExerciseVm(exercise, flags));
    return {
      id: workout.id,
      letter: String.fromCharCode(65 + index),
      name: workout.name?.trim() || `Day ${index + 1}`,
      // A redacted future workout returns with no exercises (HideFutureWorkouts); only treat an
      // empty workout as locked when the coach actually hides future workouts.
      locked: flags.lockEmpty && exercises.length === 0,
      exerciseCount: exercises.length,
      setCount: exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
      exercises
    };
  }

  private toExerciseVm(exercise: PlanWorkoutExerciseDetailDto, flags: RedactionFlags): ExerciseVm {
    // Honor the coach's flag directly so the view redacts even if the payload arrives unredacted;
    // the data-driven checks still cover plans loaded without the assignment.
    const hidden =
      flags.hideExercises || !exercise.exerciseName?.trim() || exercise.exerciseId === EMPTY_GUID;
    const sets = [...exercise.sets]
      .sort((a, b) => a.order - b.order)
      .map((set, i) => this.toSetVm(set, i + 1));
    // HideSetsReps nulls every numeric target; show one calm "hidden" note instead of empty rows.
    const hiddenTargets =
      !hidden &&
      (flags.hideSetsReps ||
        (sets.length > 0 && sets.every((s) => s.reps === null && s.weightKg === null && s.rpe === null)));
    return {
      id: exercise.id,
      name: hidden ? 'Hidden exercise' : exercise.exerciseName!.trim(),
      hidden,
      hiddenTargets,
      setSummary: this.setSummary(sets.length),
      sets
    };
  }

  private toSetVm(set: PlanSetDetailDto, num: number): SetVm {
    return {
      num,
      type: set.setType,
      typeLabel: set.setType === 'amrap' ? 'AMRAP' : set.setType.charAt(0).toUpperCase() + set.setType.slice(1),
      reps: set.targetReps,
      weightKg: set.targetWeightKg,
      rpe: set.targetRpe,
      restSeconds: set.restSeconds
    };
  }

  private setSummary(count: number): string {
    return count === 1 ? '1 set' : `${count} sets`;
  }
}
