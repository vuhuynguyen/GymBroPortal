import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import {
  ButtonComponent,
  FormFieldComponent,
  InputComponent
} from '../../../../shared/ui';
import { WorkoutPlanService } from '../../plans/workout-plan.service';
import type {
  MyAssignedPlanDto,
  PlanWorkoutDetailDto,
  WorkoutPlanDetailDto
} from '../../plans/workout-plan.model';
import type {
  SessionSource,
  StartSessionRequest
} from '../session.model';

interface AssignmentRow {
  assignmentId: string;
  planId: string;
  planName: string;
  workoutCount: number;
  detail: WorkoutPlanDetailDto;
}

@Component({
  selector: 'app-start-session-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, FormFieldComponent, InputComponent],
  templateUrl: './start-session-dialog.html',
  styleUrl: './start-session-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StartSessionDialogComponent {
  private readonly workoutPlanService = inject(WorkoutPlanService);

  readonly open = model(false);
  readonly starting = input(false);
  readonly started = output<StartSessionRequest>();

  readonly mode = signal<SessionSource>('Adhoc');
  readonly loadingAssignments = signal(false);
  readonly assignmentRows = signal<AssignmentRow[]>([]);
  readonly selectedAssignmentId = signal<string | null>(null);
  readonly selectedWorkoutId = signal<string | null>(null);
  readonly bodyweightKg = signal<string>('');

  readonly selectedAssignment = computed(() =>
    this.assignmentRows().find((r) => r.assignmentId === this.selectedAssignmentId()) ?? null
  );

  readonly availableWorkouts = computed(() => {
    const a = this.selectedAssignment();
    if (!a) return [] as WorkoutPlanDetailDto['workouts'];
    return [...a.detail.workouts].sort((x, y) => x.order - y.order);
  });

  exerciseNames(w: PlanWorkoutDetailDto): string {
    return w.exercises.map((e) => e.exerciseName?.trim() || 'Exercise').join(' · ');
  }

  totalSets(w: PlanWorkoutDetailDto): number {
    return w.exercises.reduce((sum, e) => sum + e.sets.length, 0);
  }

  readonly canStart = computed(() => {
    if (this.starting()) return false;
    if (this.mode() === 'Adhoc') return true;
    return !!this.selectedAssignmentId() && !!this.selectedWorkoutId();
  });

  constructor() {
    // Lazy-load the assignment list the first time the dialog opens with FromAssignment mode.
    effect(() => {
      if (this.open() && this.mode() === 'FromAssignment' && this.assignmentRows().length === 0 && !this.loadingAssignments()) {
        this.loadAssignments();
      }
    });
  }

  setMode(mode: SessionSource): void {
    this.mode.set(mode);
    if (mode === 'Adhoc') {
      this.selectedAssignmentId.set(null);
      this.selectedWorkoutId.set(null);
    }
  }

  selectAssignment(id: string): void {
    this.selectedAssignmentId.set(id);
    // Auto-pick the first workout for convenience.
    const first = this.availableWorkouts()[0];
    this.selectedWorkoutId.set(first?.id ?? null);
  }

  selectWorkout(id: string): void {
    this.selectedWorkoutId.set(id);
  }

  cancel(): void {
    this.open.set(false);
    this.reset();
  }

  start(): void {
    if (!this.canStart()) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const bodyweight = this.parseNumber(this.bodyweightKg());

    if (this.mode() === 'Adhoc') {
      this.started.emit({
        source: 'Adhoc',
        clientTimezone: tz,
        bodyweightKg: bodyweight
      });
      return;
    }

    this.started.emit({
      source: 'FromAssignment',
      planAssignmentId: this.selectedAssignmentId()!,
      plannedWorkoutId: this.selectedWorkoutId()!,
      clientTimezone: tz,
      bodyweightKg: bodyweight
    });
  }

  private reset(): void {
    this.mode.set('Adhoc');
    this.selectedAssignmentId.set(null);
    this.selectedWorkoutId.set(null);
    this.bodyweightKg.set('');
  }

  private parseNumber(v: string): number | null {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private loadAssignments(): void {
    this.loadingAssignments.set(true);
    this.workoutPlanService
      .listMyAssignments()
      .pipe(
        catchError(() => of([] as MyAssignedPlanDto[])),
        finalize(() => {})
      )
      .subscribe((assignments) => {
        const withPlan = assignments.filter((a): a is MyAssignedPlanDto & { planId: string } => !!a.planId);
        if (withPlan.length === 0) {
          this.assignmentRows.set([]);
          this.loadingAssignments.set(false);
          return;
        }

        // Fetch each plan's detail (in parallel) so we can show names + pick workouts.
        const detailRequests = withPlan.map((a) =>
          this.workoutPlanService.get(a.planId).pipe(catchError(() => of(null)))
        );

        forkJoin(detailRequests)
          .pipe(finalize(() => this.loadingAssignments.set(false)))
          .subscribe((details) => {
            const rows: AssignmentRow[] = [];
            withPlan.forEach((a, i) => {
              const detail = details[i];
              if (!detail) return;
              rows.push({
                assignmentId: a.id,
                planId: a.planId,
                planName: detail.name || 'Untitled plan',
                workoutCount: detail.workouts?.length ?? 0,
                detail
              });
            });
            this.assignmentRows.set(rows);
          });
      });
  }
}
