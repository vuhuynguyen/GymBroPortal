import { computed, Directive, effect, inject, signal, type Signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Observable } from 'rxjs';
import type { TableColumn } from '../../../shared/ui';
import { TenantService } from '../../../core/tenant/tenant';
import { AuthService } from '../../../core/auth/auth';

/**
 * Minimal shape every coach plan summary shares (workout + nutrition). Concrete DTOs carry extra
 * domain fields (workoutCount/durationWeeks vs mealCount/version) which the port's row mapper reads.
 */
export interface CoachPlanSummaryLike {
  id: string;
  name: string;
  description: string | null;
  createdOnUtc: string;
  isArchived: boolean;
  isDraft: boolean;
}

/** Paged-list response shape returned by both plan services. */
export interface CoachPlanListResponse<TSummary> {
  items: TSummary[];
  totalCount: number;
  pageSize: number;
}

/**
 * Per-domain configuration for {@link CoachPlanListBase}. Workout and nutrition supply one of these
 * to collapse the otherwise byte-identical list page (tenant effect, paging, archive/restore, delete
 * flow, create flow, self-assign) down to a thin subclass + template.
 */
export interface PlanListPort<TSummary extends CoachPlanSummaryLike> {
  // ── Data access (the injected service, behind a narrow port) ──────────────
  list(query: {
    page: number;
    pageSize: number;
    search?: string;
    archived?: boolean;
  }): Observable<CoachPlanListResponse<TSummary>>;
  archive(id: string): Observable<void>;
  unarchive(id: string): Observable<void>;
  delete(id: string): Observable<void>;

  // ── Row projection for the data table (domain columns differ) ─────────────
  mapRow(plan: TSummary): Record<string, unknown>;

  // ── Self-assign ("Train/Use this myself"): build the create payload + run it.
  // Returns null to skip (no userId/planId). The caller owns the HTTP; copy is in selfAssignCopy.
  selfAssign(planId: string, userId: string, row: Record<string, unknown>): Observable<unknown> | null;

  // ── Navigation + copy that differs per domain ─────────────────────────────
  /** Route base for opening the builder, e.g. `/workspace/plans` or `/workspace/nutrition-plans`. */
  readonly editRouteBase: string;
  /** Lowercase plural noun for toasts/empty states, e.g. `plans` / `nutrition plans`. */
  readonly nouns: {
    /** "Could not load {loadFailure}" */ loadFailure: string;
    /** "Could not create {createFailure}." */ createFailure: string;
    /** "Could not delete {deleteFailure}." */ deleteFailure: string;
    /** success detail shown after create */ createdDetail: string;
    /** success detail shown after delete */ deletedDetail: string;
    /** confirm-dialog noun, e.g. `plan` / `nutrition plan` */ deleteEntity: string;
    /** warn detail when builder navigation is blocked (workout: "plan builder"; nutrition: "meal builder") */
    navBlockedDetail: string;
  };
  /** Per-domain self-assign toast copy (workout → Logs page; nutrition → My Nutrition). */
  readonly selfAssignCopy: {
    /** warn summary when planId/userId is missing (workout: "Cannot start"; nutrition: "Cannot assign") */
    cannotSummary: string;
    successSummary: string;
    successDetail: string;
    duplicateDetail: string;
    /** error detail when the assign call fails for a non-duplicate reason */ errorDetail: string;
  };
}

/**
 * Shared shell for the two coach plan-list pages. The subclass provides a {@link PlanListPort}; the
 * template (columns, action labels, create dialog) stays per-domain. Behaviour-preserving extraction
 * of the former copy-paste `plans-list` ↔ `nutrition-plans-list` clones.
 */
@Directive()
export abstract class CoachPlanListBase<TSummary extends CoachPlanSummaryLike> {
  protected abstract readonly port: PlanListPort<TSummary>;

  protected readonly tenantService = inject(TenantService);
  protected readonly auth = inject(AuthService);
  protected readonly messageService = inject(MessageService);
  protected readonly router = inject(Router);

  /** Avoid duplicate list calls when tenant id unchanged. */
  private lastFetchedTenantId: string | null = null;

  readonly plans = signal<TSummary[]>([]);
  readonly totalRecords = signal(0);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  /** When true the list shows archived (retired) templates instead of active ones. */
  readonly showArchived = signal(false);

  readonly canManagePlans = computed(() => this.tenantService.currentRole() === 'Owner');

  readonly deleteTarget = signal<TSummary | null>(null);
  readonly deleteInProgress = signal(false);

  readonly createDialogOpen = signal(false);
  readonly createDialogSeed = signal(0);
  readonly createSaving = signal(false);

  abstract readonly tableColumns: TableColumn[];

  readonly deleteDialogMessage = computed(() => {
    const p = this.deleteTarget();
    return p ? `Delete ${this.port.nouns.deleteEntity} "${p.name}"? This cannot be undone.` : '';
  });

  /** Rows for the data table (plain objects) — domain-specific projection lives in the port. */
  readonly tableRows: Signal<Record<string, unknown>[]> = computed(() =>
    this.plans().map((p) => this.port.mapRow(p))
  );

  protected constructor() {
    effect(() => {
      this.tenantService.selectOwnWorkspace();
      const id = this.tenantService.activeTenantId();
      if (!id) {
        this.lastFetchedTenantId = null;
        this.plans.set([]);
        this.totalRecords.set(0);
        this.loading.set(false);
        return;
      }
      if (this.lastFetchedTenantId === id) return;
      this.lastFetchedTenantId = id;
      this.refresh();
    });
  }

  refresh(): void {
    this.loadPlans({ page: 1, pageSize: this.pageSize(), search: '' });
  }

  onTableLazyLoad(event: unknown): void {
    const payload = (event ?? {}) as {
      first?: number;
      rows?: number;
      globalFilter?: string;
      filters?: Record<string, { value?: unknown }>;
    };

    const rows = Number(payload.rows ?? this.pageSize());
    const safeRows = rows > 0 ? rows : this.pageSize();
    const first = Number(payload.first ?? 0);
    const page = Math.floor(first / safeRows) + 1;
    const globalFromFilter = payload.filters?.['global']?.value;
    const searchValue =
      typeof globalFromFilter === 'string'
        ? globalFromFilter
        : typeof payload.globalFilter === 'string'
          ? payload.globalFilter
          : '';

    this.loadPlans({ page, pageSize: safeRows, search: searchValue });
  }

  private loadPlans(query: { page: number; pageSize: number; search?: string }): void {
    this.loading.set(true);
    this.port.list({ ...query, archived: this.showArchived() }).subscribe({
      next: (response) => {
        this.plans.set(response.items);
        this.totalRecords.set(response.totalCount);
        this.pageSize.set(response.pageSize);
        this.loading.set(false);
      },
      error: () => {
        this.plans.set([]);
        this.totalRecords.set(0);
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: `Could not load ${this.port.nouns.loadFailure}`,
          detail: 'Check your connection and tenant selection.'
        });
      }
    });
  }

  createPlan(): void {
    this.createDialogSeed.update((n) => n + 1);
    this.createDialogOpen.set(true);
  }

  /** Subclass builds the domain create request from its dialog value and calls this. */
  protected submitCreate(request: Observable<unknown>): void {
    this.createSaving.set(true);
    request.subscribe({
      next: () => {
        this.createSaving.set(false);
        this.createDialogOpen.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Plan created',
          detail: this.port.nouns.createdDetail
        });
        this.refresh();
      },
      error: (err: { error?: unknown }) => {
        this.createSaving.set(false);
        const msg =
          typeof err?.error === 'string' ? err.error : `Could not create ${this.port.nouns.createFailure}.`;
        this.messageService.add({ severity: 'error', summary: 'Create failed', detail: msg });
      }
    });
  }

  openPlanById(idValue: unknown): void {
    const id = String(idValue ?? '').trim();
    if (!id) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot open plan',
        detail: 'Plan id is missing. Refresh and try again.'
      });
      return;
    }

    this.router.navigate([this.port.editRouteBase, id]).then((ok) => {
      if (!ok) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Navigation blocked',
          detail: `${this.port.nouns.navBlockedDetail} Try refreshing the page.`
        });
      }
    });
  }

  /**
   * Self-assign this plan to the current coach (full visibility) so it shows up in their own flow.
   * The per-domain payload is built by the port; the success/duplicate/error toasts are shared.
   */
  protected selfAssign(row: Record<string, unknown>): void {
    const planId = String(row['id'] ?? '').trim();
    const userId = this.auth.currentUser()?.userId;
    if (!planId || !userId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.port.selfAssignCopy.cannotSummary,
        detail: 'Please refresh and try again.'
      });
      return;
    }

    const request = this.port.selfAssign(planId, userId, row);
    if (!request) return;

    const copy = this.port.selfAssignCopy;
    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: copy.successSummary,
          detail: copy.successDetail
        });
      },
      error: (err: { error?: unknown; status?: number }) => {
        const isDuplicate = err?.status === 409;
        this.messageService.add({
          severity: isDuplicate ? 'info' : 'error',
          summary: isDuplicate ? 'Already added' : 'Could not assign',
          detail: isDuplicate
            ? copy.duplicateDetail
            : typeof err?.error === 'string'
              ? err.error
              : copy.errorDetail
        });
      }
    });
  }

  toggleArchivedView(): void {
    this.showArchived.update((v) => !v);
    this.refresh();
  }

  /** Archive (retire) or restore a plan template. */
  setArchived(row: Record<string, unknown>, archived: boolean): void {
    const id = String(row['id'] ?? '').trim();
    if (!id) return;

    const request = archived ? this.port.archive(id) : this.port.unarchive(id);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: archived ? 'Archived' : 'Restored',
          detail: archived ? 'Plan moved to the archive.' : 'Plan restored to active.'
        });
        this.refresh();
      },
      error: (err: { error?: unknown }) => {
        const msg = typeof err?.error === 'string' ? err.error : 'Could not update the plan.';
        this.messageService.add({ severity: 'error', summary: 'Update failed', detail: msg });
      }
    });
  }

  confirmDeleteRow(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    const p = this.plans().find((x) => x.id === id);
    if (p) this.deleteTarget.set(p);
  }

  onDeleteDialogChange(open: boolean): void {
    if (!open) this.deleteTarget.set(null);
  }

  onDeleteConfirmed(): void {
    const plan = this.deleteTarget();
    if (!plan) return;

    this.deleteInProgress.set(true);
    this.port.delete(plan.id).subscribe({
      next: () => {
        this.deleteInProgress.set(false);
        this.deleteTarget.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: this.port.nouns.deletedDetail
        });
        this.refresh();
      },
      error: (err: { error?: unknown }) => {
        this.deleteInProgress.set(false);
        const msg =
          typeof err?.error === 'string' ? err.error : `Could not delete ${this.port.nouns.deleteFailure}.`;
        this.messageService.add({ severity: 'error', summary: 'Delete failed', detail: msg });
      }
    });
  }

  formatCellDate(value: unknown): string {
    const s = value != null && value !== '' ? String(value) : '';
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatOptionalNumber(value: unknown): string {
    if (value == null || value === '') return '—';
    return String(value);
  }
}
