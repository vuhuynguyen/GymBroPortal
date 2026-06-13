import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import {
  ButtonComponent,
  ConfirmSplitDialogComponent,
  DataTableCellTemplateDirective,
  DataTableComponent,
  PageContainerComponent,
  PageHeaderComponent,
  type TableColumn
} from '../../../../shared/ui';
import { TenantService } from '../../../../core/tenant/tenant';
import { AuthService } from '../../../../core/auth/auth';
import { NutritionPlanService } from '../nutrition-plan.service';
import type { NutritionPlanSummaryDto } from '../nutrition-plan.model';
import { NutritionAssignmentService } from '../../nutrition-assignments/nutrition-assignment.service';
import {
  NutritionPlanDetailsDialogComponent,
  type NutritionPlanDetailsFormValue
} from '../nutrition-plan-details-dialog/nutrition-plan-details-dialog';

/** Coach nutrition plan list — clone of `plans-list` against `/api/nutrition/plans`. */
@Component({
  selector: 'app-nutrition-plans-list',
  standalone: true,
  imports: [
    PageContainerComponent,
    PageHeaderComponent,
    DataTableComponent,
    DataTableCellTemplateDirective,
    ButtonComponent,
    ConfirmSplitDialogComponent,
    NutritionPlanDetailsDialogComponent
  ],
  templateUrl: './nutrition-plans-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NutritionPlansListComponent {
  private readonly nutritionPlanService = inject(NutritionPlanService);
  private readonly assignmentService = inject(NutritionAssignmentService);
  private readonly tenantService = inject(TenantService);
  private readonly auth = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  /** Avoid duplicate list calls when tenant id unchanged. */
  private lastFetchedTenantId: string | null = null;

  readonly plans = signal<NutritionPlanSummaryDto[]>([]);
  readonly totalRecords = signal(0);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  /** When true the list shows archived (retired) templates instead of active ones. */
  readonly showArchived = signal(false);

  readonly canManagePlans = computed(() => this.tenantService.currentRole() === 'Owner');

  readonly deleteTarget = signal<NutritionPlanSummaryDto | null>(null);
  readonly deleteInProgress = signal(false);

  readonly createDialogOpen = signal(false);
  readonly createDialogSeed = signal(0);
  readonly createSaving = signal(false);

  readonly createInitial: NutritionPlanDetailsFormValue = { name: '', description: '' };

  readonly deleteDialogMessage = computed(() => {
    const p = this.deleteTarget();
    return p ? `Delete nutrition plan "${p.name}"? This cannot be undone.` : '';
  });

  readonly tableColumns: TableColumn[] = [
    { field: 'name', header: 'Name', type: 'custom', filter: true, filterType: 'text' },
    { field: 'description', header: 'Description', filter: true, filterType: 'text' },
    { field: 'mealCount', header: 'Meals', filter: false },
    { field: 'version', header: 'Version', filter: false },
    { field: 'createdOnUtc', header: 'Created', type: 'custom', filter: false },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  constructor() {
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

  /** Rows for the data table (plain objects). */
  readonly tableRows = computed(() =>
    this.plans().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      mealCount: p.mealCount,
      version: `v${p.version}`,
      createdOnUtc: p.createdOnUtc,
      isArchived: p.isArchived,
      isDraft: p.isDraft
    }))
  );

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
    const searchValue = typeof globalFromFilter === 'string'
      ? globalFromFilter
      : typeof payload.globalFilter === 'string'
        ? payload.globalFilter
        : '';

    this.loadPlans({ page, pageSize: safeRows, search: searchValue });
  }

  private loadPlans(query: { page: number; pageSize: number; search?: string }): void {
    this.loading.set(true);
    this.nutritionPlanService.list({ ...query, archived: this.showArchived() }).subscribe({
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
          summary: 'Could not load nutrition plans',
          detail: 'Check your connection and tenant selection.'
        });
      }
    });
  }

  createPlan(): void {
    this.createDialogSeed.update((n) => n + 1);
    this.createDialogOpen.set(true);
  }

  onCreateDialogSaved(v: NutritionPlanDetailsFormValue): void {
    this.createSaving.set(true);
    this.nutritionPlanService
      .create({ name: v.name.trim(), description: v.description?.trim() || null })
      .subscribe({
        next: () => {
          this.createSaving.set(false);
          this.createDialogOpen.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Plan created',
            detail: 'Plan appears in the list. Click Edit to open the meal builder.'
          });
          this.refresh();
        },
        error: (err: { error?: unknown }) => {
          this.createSaving.set(false);
          const msg = typeof err?.error === 'string' ? err.error : 'Could not create nutrition plan.';
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

    this.router.navigate(['/workspace/nutrition-plans', id]).then((ok) => {
      if (!ok) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Navigation blocked',
          detail: 'Could not open the meal builder. Try refreshing the page.'
        });
      }
    });
  }

  /**
   * Self-assign: assign this nutrition plan to the current coach (full visibility) so it shows up in
   * their own My Nutrition flow. Nutrition analog of the workout list's "Train this myself".
   */
  useThisMyself(row: Record<string, unknown>): void {
    const planId = String(row['id'] ?? '').trim();
    const userId = this.auth.currentUser()?.userId;
    if (!planId || !userId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot assign',
        detail: 'Please refresh and try again.'
      });
      return;
    }

    const today = new Date().toLocaleDateString('en-CA');

    this.assignmentService
      .create({
        traineeId: userId,
        planId,
        startDate: today,
        endDate: null,
        visibilityMode: 'Full',
        hideMacroTargets: false,
        disableTraineeEditing: false
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Assigned to you',
            detail: 'Find it any time on your My Nutrition page.'
          });
        },
        error: (err: { error?: unknown; status?: number }) => {
          const isDuplicate = err?.status === 409;
          this.messageService.add({
            severity: isDuplicate ? 'info' : 'error',
            summary: isDuplicate ? 'Already added' : 'Could not assign',
            detail: isDuplicate
              ? 'You are already following this nutrition plan.'
              : typeof err?.error === 'string'
                ? err.error
                : 'Could not add this plan to your nutrition.'
          });
        }
      });
  }

  toggleArchivedView(): void {
    this.showArchived.update((v) => !v);
    this.refresh();
  }

  /** Archive (retire) or restore a nutrition plan template. */
  setArchived(row: Record<string, unknown>, archived: boolean): void {
    const id = String(row['id'] ?? '').trim();
    if (!id) return;

    const request = archived
      ? this.nutritionPlanService.archive(id)
      : this.nutritionPlanService.unarchive(id);

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
    this.nutritionPlanService.delete(plan.id).subscribe({
      next: () => {
        this.deleteInProgress.set(false);
        this.deleteTarget.set(null);
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Nutrition plan removed.' });
        this.refresh();
      },
      error: (err: { error?: unknown }) => {
        this.deleteInProgress.set(false);
        const msg = typeof err?.error === 'string' ? err.error : 'Could not delete nutrition plan.';
        this.messageService.add({ severity: 'error', summary: 'Delete failed', detail: msg });
      }
    });
  }

  formatCellDate(value: unknown): string {
    const s = value != null && value !== '' ? String(value) : '';
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
