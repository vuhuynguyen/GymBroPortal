import { computed, Directive, effect, inject, signal } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TenantService } from '../../../core/tenant/tenant';
import { WorkspaceService } from '../workspace';
import type { MemberDto } from '../workspace.model';

/** Common fields the orchestrator reads off any assignment summary (workout + nutrition). */
export interface AssignmentSummaryLike {
  id: string;
  traineeId: string;
  latestPlanVersion: number;
}

/** Paged-list shape returned by both assignment services. */
export interface AssignmentListResponse<TSummary> {
  items: TSummary[];
}

/**
 * Per-domain strategy for {@link AssignmentsPageBase}. Folds the workout/nutrition differences
 * (assignable-trainee rule, revoke plan-name source, toast nouns, the data port) behind one object so
 * the orchestrator logic — load, create, update, pause/resume, apply-latest, revoke — is shared.
 */
export interface AssignmentsPort<TSummary extends AssignmentSummaryLike, TPlan, TCreate, TUpdate> {
  // ── Data access (the injected assignment service, behind a narrow port) ───
  listPlans(query: { page: number; pageSize: number }): Observable<{ items: TPlan[] }>;
  listAssignments(query: { page: number; pageSize: number }): Observable<AssignmentListResponse<TSummary>>;
  create(body: TCreate): Observable<{ id: string }>;
  update(id: string, body: TUpdate): Observable<void>;
  pause(id: string): Observable<void>;
  resume(id: string): Observable<void>;
  applyLatestVersion(id: string): Observable<{ updated: boolean }>;
  revoke(id: string): Observable<void>;

  // ── Strategy that genuinely differs per domain ────────────────────────────
  /** Filter the gym roster down to who can be assigned (workout: clients only; nutrition: everyone). */
  assignableTrainees(members: MemberDto[]): MemberDto[];
  /** Plan name shown in the revoke confirm (workout: lookup in `plans`; nutrition: `assignment.planName`). */
  revokePlanName(assignment: TSummary, plans: TPlan[]): string;

  // ── Copy that differs per domain ──────────────────────────────────────────
  readonly nouns: {
    /** error detail header noun: "Could not load {loadFailure}" */ loadFailure: string;
    /** create-success detail, e.g. "Assigned plan to N trainees." — N is interpolated as {count}{plural} */
    assignedDetail: (count: number) => string;
    /** pause-success detail (workout: "…workout picker."; nutrition: "…nutrition.") */ pausedDetail: string;
    /** revoke-success detail */ revokedDetail: string;
  };
}

/**
 * Shared orchestrator for the two coach assignment-management pages. The subclass supplies an
 * {@link AssignmentsPort}; the template wires the per-domain list / assign-wizard / edit-panel children.
 * Behaviour-preserving extraction of the former `plan-assignments` ↔ `nutrition-assignments` clones.
 */
@Directive()
export abstract class AssignmentsPageBase<
  TSummary extends AssignmentSummaryLike,
  TPlan,
  TCreate,
  TUpdate
> {
  protected abstract readonly port: AssignmentsPort<TSummary, TPlan, TCreate, TUpdate>;

  protected readonly workspaceService = inject(WorkspaceService);
  protected readonly tenantService = inject(TenantService);
  protected readonly messageService = inject(MessageService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly assignmentModalOpen = signal(false);
  readonly editAssignment = signal<TSummary | null>(null);
  readonly revokeTarget = signal<TSummary | null>(null);

  readonly plans = signal<TPlan[]>([]);
  readonly assignments = signal<TSummary[]>([]);
  readonly trainees = computed<MemberDto[]>(() => this.workspaceService.members());
  readonly assignableTrainees = computed<MemberDto[]>(() => this.port.assignableTrainees(this.trainees()));

  readonly revokeDialogMessage = computed(() => {
    const assignment = this.revokeTarget();
    if (!assignment) return '';
    const trainee = this.trainees().find((x) => x.userId === assignment.traineeId)?.name ?? 'this trainee';
    const plan = this.port.revokePlanName(assignment, this.plans());
    return `Revoke "${plan}" for ${trainee}?`;
  });

  /** Avoid refetching when tenants[] refreshes but own workspace id is unchanged. */
  private lastFetchedOwnTenantId: string | null = null;

  protected constructor() {
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
      plans: this.port.listPlans({ page: 1, pageSize: 200 }),
      assignments: this.port.listAssignments({ page: 1, pageSize: 200 })
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
          summary: `Could not load ${this.port.nouns.loadFailure}`,
          detail: 'Try refreshing the page.'
        });
      }
    });
  }

  onAssignConfirmed(payloads: TCreate[]): void {
    if (payloads.length === 0) return;
    this.saving.set(true);
    forkJoin(payloads.map((payload) => this.port.create(payload))).subscribe({
      next: () => {
        this.saving.set(false);
        this.assignmentModalOpen.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Assignments created',
          detail: this.port.nouns.assignedDetail(payloads.length)
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

  onEditSave(payload: TUpdate): void {
    const assignment = this.editAssignment();
    if (!assignment) return;
    this.saving.set(true);
    this.port.update(assignment.id, payload).subscribe({
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
    this.port.applyLatestVersion(assignment.id).subscribe({
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
    const request = event.active ? this.port.resume(event.id) : this.port.pause(event.id);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: event.active ? 'Resumed' : 'Paused',
          detail: event.active ? 'Assignment is active again.' : this.port.nouns.pausedDetail
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
    this.port.revoke(assignment.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.revokeTarget.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Assignment revoked',
          detail: this.port.nouns.revokedDetail
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
