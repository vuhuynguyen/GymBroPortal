import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ButtonComponent,
  ConfirmSplitDialogComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '../../../shared/ui';
import { NutritionPlanService } from '../nutrition-plans/nutrition-plan.service';
import type { NutritionPlanSummaryDto } from '../nutrition-plans/nutrition-plan.model';
import { NutritionAssignmentListComponent } from './nutrition-assignment-list/nutrition-assignment-list';
import { NutritionAssignmentEditPanelComponent } from './nutrition-assignment-edit-panel/nutrition-assignment-edit-panel';
import { AssignNutritionPlanModalComponent } from './assign-nutrition-plan-modal/assign-nutrition-plan-modal';
import type {
  CreateNutritionAssignmentRequest,
  NutritionAssignmentSummaryDto,
  UpdateNutritionAssignmentRequest
} from './nutrition-assignment.model';
import { NutritionAssignmentService } from './nutrition-assignment.service';
import { AssignmentsPageBase, type AssignmentsPort } from '../shared/assignments-page-base';

/** Nutrition assignment management page — thin config over {@link AssignmentsPageBase}. */
@Component({
  selector: 'app-nutrition-assignments',
  standalone: true,
  imports: [
    PageContainerComponent,
    PageHeaderComponent,
    ButtonComponent,
    ConfirmSplitDialogComponent,
    NutritionAssignmentListComponent,
    NutritionAssignmentEditPanelComponent,
    AssignNutritionPlanModalComponent
  ],
  templateUrl: './nutrition-assignments.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NutritionAssignmentsComponent extends AssignmentsPageBase<
  NutritionAssignmentSummaryDto,
  NutritionPlanSummaryDto,
  CreateNutritionAssignmentRequest,
  UpdateNutritionAssignmentRequest
> {
  private readonly assignmentService = inject(NutritionAssignmentService);
  private readonly nutritionPlanService = inject(NutritionPlanService);

  protected readonly port: AssignmentsPort<
    NutritionAssignmentSummaryDto,
    NutritionPlanSummaryDto,
    CreateNutritionAssignmentRequest,
    UpdateNutritionAssignmentRequest
  > = {
    listPlans: (q) => this.nutritionPlanService.list(q),
    listAssignments: (q) => this.assignmentService.list(q),
    create: (body) => this.assignmentService.create(body),
    update: (id, body) => this.assignmentService.update(id, body),
    pause: (id) => this.assignmentService.pause(id),
    resume: (id) => this.assignmentService.resume(id),
    applyLatestVersion: (id) => this.assignmentService.applyLatestVersion(id),
    revoke: (id) => this.assignmentService.revoke(id),
    /**
     * Any gym member can be assigned a plan — including the owner themselves: a self-train owner is
     * both coach and trainee, so they must be able to assign a plan to themselves (the backend allows it).
     */
    assignableTrainees: (members) => members,
    revokePlanName: (assignment) => assignment.planName,
    nouns: {
      loadFailure: 'nutrition assignments',
      assignedDetail: (count) => `Assigned nutrition plan to ${count} trainee${count === 1 ? '' : 's'}.`,
      pausedDetail: 'Assignment paused — hidden from the trainee’s nutrition.',
      revokedDetail: 'Nutrition plan assignment was removed.'
    }
  };

  constructor() {
    super();
  }
}
