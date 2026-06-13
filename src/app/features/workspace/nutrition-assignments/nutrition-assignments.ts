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

/** Nutrition assignment management page — clone of `plan-assignments` (list + assign + edit/revoke/pause). */
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
export class NutritionAssignmentsComponent {
  private readonly assignmentService = inject(NutritionAssignmentService);
  private readonly nutritionPlanService = inject(NutritionPlanService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly tenantService = inject(TenantService);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly assignmentModalOpen = signal(false);
  readonly editAssignment = signal<NutritionAssignmentSummaryDto | null>(null);
  readonly revokeTarget = signal<NutritionAssignmentSummaryDto | null>(null);

  readonly plans = signal<NutritionPlanSummaryDto[]>([]);
  readonly assignments = signal<NutritionAssignmentSummaryDto[]>([]);
  readonly trainees = computed<MemberDto[]>(() => this.workspaceService.members());
  readonly revokeDialogMessage = computed(() => {
    const assignment = this.revokeTarget();
    if (!assignment) return '';
    const trainee = this.trainees().find((x) => x.userId === assignment.traineeId)?.name ?? 'this trainee';
    return `Revoke "${assignment.planName}" for ${trainee}?`;
  });
  /** Any gym member can be assigned a plan — including the owner themselves: a self-train owner is
   *  both coach and trainee, so they must be able to assign a plan to themselves (the backend allows
   *  it — the owner is a member of their own gym). Clients are also assignable as before. */
  readonly assignableTrainees = computed<MemberDto[]>(() => this.trainees());

  /** Avoid refetching when tenants[] refreshes but own workspace id is unchanged. */
  private lastFetchedOwnTenantId: string | null = null;

  constructor() {
    effect(() => {
      const id = this.tenantService.ownTenant()?.id ?? null;
      if (!id) {
        this.lastFetchedOwnTenantId = null;
        return;
      }
      this.tenantService.selectOwnWorkspace();
      if (this.lastFetchedOwnTenantId === id) return;
      this.lastFetchedOwnTenantId = id;
      this.workspaceService.loadMembers(id);
      this.refresh();
    });
  }

  refresh(): void {
    this.loading.set(true);
    forkJoin({
      plans: this.nutritionPlanService.list({ page: 1, pageSize: 200 }),
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
          summary: 'Could not load nutrition assignments',
          detail: 'Try refreshing the page.'
        });
      }
    });
  }

  onAssignConfirmed(payloads: CreateNutritionAssignmentRequest[]): void {
    if (payloads.length === 0) return;
    this.saving.set(true);
    forkJoin(payloads.map((payload) => this.assignmentService.create(payload))).subscribe({
      next: () => {
        this.saving.set(false);
        this.assignmentModalOpen.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Assignments created',
          detail: `Assigned nutrition plan to ${payloads.length} trainee${payloads.length === 1 ? '' : 's'}.`
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

  onEditSave(payload: UpdateNutritionAssignmentRequest): void {
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

  onApplyLatest(assignmentId: string): void {
    const assignment = this.assignments().find((x) => x.id === assignmentId);
    if (!assignment) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot update version',
        detail: 'Assignment was not found in current list. Please refresh and try again.'
      });
      return;
    }
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

  onPauseToggled(event: { id: string; active: boolean }): void {
    const request = event.active
      ? this.assignmentService.resume(event.id)
      : this.assignmentService.pause(event.id);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: event.active ? 'Resumed' : 'Paused',
          detail: event.active
            ? 'Assignment is active again.'
            : 'Assignment paused — hidden from the trainee’s nutrition.'
        });
        this.refresh();
      },
      error: (err: { error?: unknown }) => {
        const msg = typeof err?.error === 'string' ? err.error : 'Could not update the assignment.';
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
          detail: 'Nutrition plan assignment was removed.'
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
