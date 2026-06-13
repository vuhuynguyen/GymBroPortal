import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ButtonComponent,
  ConfirmSplitDialogComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '../../../shared/ui';
import { WorkoutPlanService } from '../plans/workout-plan.service';
import type { WorkoutPlanSummaryDto } from '../plans/workout-plan.model';
import { AssignmentListComponent } from './assignment-list/assignment-list';
import { AssignmentEditPanelComponent } from './assignment-edit-panel/assignment-edit-panel';
import { AssignPlanModalComponent } from './assign-plan-modal/assign-plan-modal';
import type {
  CreatePlanAssignmentRequest,
  PlanAssignmentSummaryDto,
  UpdatePlanAssignmentRequest
} from './plan-assignment.model';
import { PlanAssignmentService } from './plan-assignment.service';
import { AssignmentsPageBase, type AssignmentsPort } from '../shared/assignments-page-base';

@Component({
  selector: 'app-plan-assignments',
  standalone: true,
  imports: [
    PageContainerComponent,
    PageHeaderComponent,
    ButtonComponent,
    ConfirmSplitDialogComponent,
    AssignmentListComponent,
    AssignPlanModalComponent,
    AssignmentEditPanelComponent
  ],
  templateUrl: './plan-assignments.html',
  styleUrl: './plan-assignments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanAssignmentsComponent extends AssignmentsPageBase<
  PlanAssignmentSummaryDto,
  WorkoutPlanSummaryDto,
  CreatePlanAssignmentRequest,
  UpdatePlanAssignmentRequest
> {
  private readonly assignmentService = inject(PlanAssignmentService);
  private readonly workoutPlanService = inject(WorkoutPlanService);

  protected readonly port: AssignmentsPort<
    PlanAssignmentSummaryDto,
    WorkoutPlanSummaryDto,
    CreatePlanAssignmentRequest,
    UpdatePlanAssignmentRequest
  > = {
    listPlans: (q) => this.workoutPlanService.list(q),
    listAssignments: (q) => this.assignmentService.list(q),
    create: (body) => this.assignmentService.create(body),
    update: (id, body) => this.assignmentService.update(id, body),
    pause: (id) => this.assignmentService.pause(id),
    resume: (id) => this.assignmentService.resume(id),
    applyLatestVersion: (id) => this.assignmentService.applyLatestVersion(id),
    revoke: (id) => this.assignmentService.revoke(id),
    /**
     * Assignment is coach → client: the picker offers only Clients, never the coach themselves.
     * A coach who wants to follow their own plan uses "Train this myself" on the Plans page.
     */
    assignableTrainees: (members) => members.filter((m) => m.role !== 'Owner'),
    revokePlanName: (assignment, plans) => plans.find((x) => x.id === assignment.planId)?.name ?? 'this plan',
    nouns: {
      loadFailure: 'assignments',
      assignedDetail: (count) => `Assigned plan to ${count} trainee${count === 1 ? '' : 's'}.`,
      pausedDetail: 'Assignment paused — hidden from the trainee’s workout picker.',
      revokedDetail: 'Plan assignment was removed.'
    }
  };

  constructor() {
    super();
  }
}
