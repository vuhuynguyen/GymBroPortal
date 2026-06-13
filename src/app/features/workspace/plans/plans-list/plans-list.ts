import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ButtonComponent,
  ConfirmSplitDialogComponent,
  DataTableCellTemplateDirective,
  DataTableComponent,
  PageContainerComponent,
  PageHeaderComponent,
  type TableColumn
} from '../../../../shared/ui';
import { WorkoutPlanService } from '../workout-plan.service';
import type { WorkoutPlanSummaryDto } from '../workout-plan.model';
import { PlanAssignmentService } from '../../plan-assignments/plan-assignment.service';
import {
  PlanDetailsFormDialogComponent,
  type PlanDetailsFormValue
} from '../plan-details-form-dialog/plan-details-form-dialog';
import { CoachPlanListBase, type PlanListPort } from '../../shared/coach-plan-list-base';

@Component({
  selector: 'app-plans-list',
  standalone: true,
  imports: [
    PageContainerComponent,
    PageHeaderComponent,
    DataTableComponent,
    DataTableCellTemplateDirective,
    ButtonComponent,
    ConfirmSplitDialogComponent,
    PlanDetailsFormDialogComponent
  ],
  templateUrl: './plans-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlansListComponent extends CoachPlanListBase<WorkoutPlanSummaryDto> {
  private readonly workoutPlanService = inject(WorkoutPlanService);
  private readonly assignmentService = inject(PlanAssignmentService);

  readonly createInitial: PlanDetailsFormValue = {
    name: '',
    description: '',
    durationWeeks: '',
    workoutsPerWeek: ''
  };

  readonly tableColumns: TableColumn[] = [
    { field: 'name', header: 'Name', type: 'custom', filter: true, filterType: 'text' },
    { field: 'description', header: 'Description', filter: true, filterType: 'text' },
    { field: 'workoutCount', header: 'Workouts', filter: false },
    { field: 'durationWeeks', header: 'Weeks', filter: false },
    { field: 'workoutsPerWeek', header: 'Per week', filter: false },
    { field: 'createdOnUtc', header: 'Created', type: 'custom', filter: false },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  protected readonly port: PlanListPort<WorkoutPlanSummaryDto> = {
    list: (q) => this.workoutPlanService.list(q),
    archive: (id) => this.workoutPlanService.archive(id),
    unarchive: (id) => this.workoutPlanService.unarchive(id),
    delete: (id) => this.workoutPlanService.delete(id),
    mapRow: (p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      workoutCount: p.workoutCount,
      durationWeeks: p.durationWeeks,
      workoutsPerWeek: p.workoutsPerWeek,
      createdOnUtc: p.createdOnUtc,
      isArchived: p.isArchived,
      isDraft: p.isDraft
    }),
    selfAssign: (planId, userId, row) => {
      const perWeek = Number(row['workoutsPerWeek']);
      const frequency = perWeek >= 1 && perWeek <= 7 ? perWeek : 3;
      const today = new Date().toISOString().slice(0, 10);
      return this.assignmentService.create({
        traineeId: userId,
        planId,
        startDate: today,
        frequencyDaysPerWeek: frequency,
        visibilityMode: 'Full',
        hideExercises: false,
        hideSetsReps: false,
        hideFutureWorkouts: false,
        disableTraineeEditing: false,
        snapshotJson: null
      });
    },
    editRouteBase: '/workspace/plans',
    nouns: {
      loadFailure: 'plans',
      createFailure: 'plan',
      deleteFailure: 'plan',
      createdDetail: 'Plan appears in the list. Click Edit to open builder.',
      deletedDetail: 'Plan removed.',
      deleteEntity: 'plan',
      navBlockedDetail: 'Could not open plan builder.'
    },
    selfAssignCopy: {
      cannotSummary: 'Cannot start',
      successSummary: 'Added to your workouts',
      successDetail: 'Start it any time from the Logs page.',
      duplicateDetail: 'You are already training this plan.',
      errorDetail: 'Could not add this plan to your workouts.'
    }
  };

  constructor() {
    super();
  }

  /** Train this myself — self-assign with full visibility (template binding). */
  trainThisMyself(row: Record<string, unknown>): void {
    this.selfAssign(row);
  }

  onCreateDialogSaved(v: PlanDetailsFormValue): void {
    const durationRaw = v.durationWeeks.trim();
    const perWeekRaw = v.workoutsPerWeek.trim();
    const durationWeeks = durationRaw ? Number(durationRaw) : null;
    const workoutsPerWeek = perWeekRaw ? Number(perWeekRaw) : null;

    this.submitCreate(
      this.workoutPlanService.create({
        name: v.name.trim(),
        description: v.description?.trim() || null,
        durationWeeks,
        workoutsPerWeek
      })
    );
  }
}
