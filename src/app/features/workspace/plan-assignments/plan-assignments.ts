import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import {
  ButtonComponent,
  ConfirmSplitDialogComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '../../../shared/ui';
import { TenantService } from '../../../core/tenant/tenant';
import { WorkspaceService } from '../workspace';
import type { MemberDto } from '../workspace.model';
import { WorkoutPlanService } from '../plans/workout-plan.service';
import type { WorkoutPlanSummaryDto } from '../plans/workout-plan.model';
import { AssignmentListComponent } from './assignment-list/assignment-list';
import { AssignmentEditPanelComponent } from './assignment-edit-panel/assignment-edit-panel';
import { AssignPlanModalComponent } from './assign-plan-modal/assign-plan-modal';
import {
  CreatePlanAssignmentRequest,
  PlanAssignmentSummaryDto,
  UpdatePlanAssignmentRequest
} from './plan-assignment.model';
import { PlanAssignmentService } from './plan-assignment.service';

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
export class PlanAssignmentsComponent {
  private readonly assignmentService = inject(PlanAssignmentService);
  private readonly workoutPlanService = inject(WorkoutPlanService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly tenantService = inject(TenantService);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly assignmentModalOpen = signal(false);
  readonly editAssignment = signal<PlanAssignmentSummaryDto | null>(null);
  readonly revokeTarget = signal<PlanAssignmentSummaryDto | null>(null);

  readonly plans = signal<WorkoutPlanSummaryDto[]>([]);
  readonly assignments = signal<PlanAssignmentSummaryDto[]>([]);
  readonly trainees = computed<MemberDto[]>(() => this.workspaceService.members());
  readonly revokeDialogMessage = computed(() => {
    const assignment = this.revokeTarget();
    if (!assignment) return '';
    const trainee = this.trainees().find((x) => x.userId === assignment.traineeId)?.name ?? 'this trainee';
    const plan = this.plans().find((x) => x.id === assignment.planId)?.name ?? 'this plan';
    return `Revoke "${plan}" for ${trainee}?`;
  });

  constructor() {
    effect(() => {
      const ownTenant = this.tenantService.ownTenant();
      if (!ownTenant) return;
      this.tenantService.selectOwnWorkspace();
      this.workspaceService.loadMembers(ownTenant.id);
      this.refresh();
    });
  }

  refresh(): void {
    this.loading.set(true);
    forkJoin({
      plans: this.workoutPlanService.list({ page: 1, pageSize: 200 }),
      assignments: this.assignmentService.list({ page: 1, pageSize: 200 })
    }).subscribe({
      next: ({ plans, assignments }) => {
        this.loading.set(false);
        this.plans.set(plans.items);
        this.assignments.set(assignments.items);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not load assignments',
          detail: 'Try refreshing the page.'
        });
      }
    });
  }

  onAssignConfirmed(payloads: CreatePlanAssignmentRequest[]): void {
    if (payloads.length === 0) return;
    this.saving.set(true);
    forkJoin(payloads.map((payload) => this.assignmentService.create(payload))).subscribe({
      next: () => {
        this.saving.set(false);
        this.assignmentModalOpen.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Assignments created',
          detail: `Assigned plan to ${payloads.length} trainee${payloads.length === 1 ? '' : 's'}.`
        });
        this.refresh();
      },
      error: (err: { error?: unknown }) => {
        this.saving.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Could not create assignments.';
        this.messageService.add({ severity: 'error', summary: 'Assignment failed', detail: msg });
      }
    });
  }

  onEditSave(payload: UpdatePlanAssignmentRequest): void {
    const assignment = this.editAssignment();
    if (!assignment) return;
    this.saving.set(true);
    this.assignmentService.update(assignment.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.editAssignment.set(null);
        this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'Assignment settings saved.' });
        this.refresh();
      },
      error: (err: { error?: unknown }) => {
        this.saving.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Could not update assignment.';
        this.messageService.add({ severity: 'error', summary: 'Update failed', detail: msg });
      }
    });
  }

  onEditRequested(assignmentId: string): void {
    const assignment = this.assignments().find((x) => x.id === assignmentId);
    if (!assignment) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot open editor',
        detail: 'Assignment was not found in current list. Please refresh and try again.'
      });
      return;
    }

    this.editAssignment.set(assignment);
  }

  onApplyLatestById(assignmentId: string): void {
    const assignment = this.assignments().find((x) => x.id === assignmentId);
    if (!assignment) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot update version',
        detail: 'Assignment was not found in current list. Please refresh and try again.'
      });
      return;
    }
    this.onApplyLatest(assignment);
  }

  onApplyLatest(assignment: PlanAssignmentSummaryDto): void {
    this.saving.set(true);
    this.assignmentService.applyLatestVersion(assignment.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Version updated',
          detail: `Assignment updated to v${assignment.latestPlanVersion}.`
        });
        this.refresh();
      },
      error: (err: { error?: unknown }) => {
        this.saving.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Could not apply latest version.';
        this.messageService.add({ severity: 'error', summary: 'Update failed', detail: msg });
      }
    });
  }

  onRevokeRequested(assignmentId: string): void {
    const assignment = this.assignments().find((x) => x.id === assignmentId);
    if (!assignment) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot revoke assignment',
        detail: 'Assignment was not found in current list. Please refresh and try again.'
      });
      return;
    }
    this.revokeTarget.set(assignment);
  }

  onRevokeConfirm(): void {
    const assignment = this.revokeTarget();
    if (!assignment) return;
    this.saving.set(true);
    this.assignmentService.revoke(assignment.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.revokeTarget.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Assignment revoked',
          detail: 'Plan assignment was removed.'
        });
        this.refresh();
      },
      error: (err: { error?: unknown }) => {
        this.saving.set(false);
        const msg = typeof err.error === 'string' ? err.error : 'Could not revoke assignment.';
        this.messageService.add({ severity: 'error', summary: 'Revoke failed', detail: msg });
      }
    });
  }
}
