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
import { WorkoutPlanService } from '../workout-plan.service';
import type { WorkoutPlanSummaryDto } from '../workout-plan.model';
import {
  PlanDetailsFormDialogComponent,
  type PlanDetailsFormValue
} from '../plan-details-form-dialog/plan-details-form-dialog';

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
export class PlansListComponent {
  private readonly workoutPlanService = inject(WorkoutPlanService);
  private readonly tenantService = inject(TenantService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  /** Avoid duplicate list calls when tenant id unchanged. */
  private lastFetchedTenantId: string | null = null;

  readonly plans = signal<WorkoutPlanSummaryDto[]>([]);
  readonly totalRecords = signal(0);
  readonly pageSize = signal(10);
  readonly loading = signal(false);

  readonly canManagePlans = computed(() => this.tenantService.currentRole() === 'Owner');

  readonly deleteTarget = signal<WorkoutPlanSummaryDto | null>(null);
  readonly deleteInProgress = signal(false);

  readonly createDialogOpen = signal(false);
  readonly createDialogSeed = signal(0);
  readonly createSaving = signal(false);

  readonly createInitial: PlanDetailsFormValue = {
    name: '',
    description: '',
    durationWeeks: '',
    workoutsPerWeek: ''
  };

  readonly deleteDialogMessage = computed(() => {
    const p = this.deleteTarget();
    return p ? `Delete plan "${p.name}"? This cannot be undone.` : '';
  });

  readonly tableColumns: TableColumn[] = [
    { field: 'name', header: 'Name', type: 'custom', filter: true, filterType: 'text' },
    { field: 'description', header: 'Description', filter: true, filterType: 'text' },
    { field: 'workoutCount', header: 'Workouts', filter: false },
    { field: 'durationWeeks', header: 'Weeks', filter: false },
    { field: 'workoutsPerWeek', header: 'Per week', filter: false },
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

  /** Rows for {@link DataTableComponent} (plain objects). */
  readonly tableRows = computed(() =>
    this.plans().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      workoutCount: p.workoutCount,
      durationWeeks: p.durationWeeks,
      workoutsPerWeek: p.workoutsPerWeek,
      createdOnUtc: p.createdOnUtc
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
    this.workoutPlanService.list(query).subscribe({
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
          summary: 'Could not load plans',
          detail: 'Check your connection and tenant selection.'
        });
      }
    });
  }

  createPlan(): void {
    this.createDialogSeed.update((n) => n + 1);
    this.createDialogOpen.set(true);
  }

  onCreateDialogSaved(v: PlanDetailsFormValue): void {
    const durationRaw = v.durationWeeks.trim();
    const perWeekRaw = v.workoutsPerWeek.trim();
    const durationWeeks = durationRaw ? Number(durationRaw) : null;
    const workoutsPerWeek = perWeekRaw ? Number(perWeekRaw) : null;

    this.createSaving.set(true);
    this.workoutPlanService
      .create({
        name: v.name.trim(),
        description: v.description?.trim() || null,
        durationWeeks,
        workoutsPerWeek
      })
      .subscribe({
        next: (res) => {
          this.createSaving.set(false);
          this.createDialogOpen.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Plan created',
            detail: 'Plan appears in the list. Click Edit to open builder.'
          });
          this.refresh();
        },
        error: (err: { error?: unknown }) => {
          this.createSaving.set(false);
          const msg = typeof err?.error === 'string' ? err.error : 'Could not create plan.';
          this.messageService.add({ severity: 'error', summary: 'Create failed', detail: msg });
        }
      });
  }

  openPlan(row: Record<string, unknown>): void {
    this.openPlanById(row['id']);
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

    this.router.navigate(['/workspace/plans', id]).then((ok) => {
      if (!ok) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Navigation blocked',
          detail: 'Could not open plan builder. Try refreshing the page.'
        });
      }
    });
  }

  confirmDelete(plan: WorkoutPlanSummaryDto): void {
    this.deleteTarget.set(plan);
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
    this.workoutPlanService.delete(plan.id).subscribe({
      next: () => {
        this.deleteInProgress.set(false);
        this.deleteTarget.set(null);
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Plan removed.' });
        this.refresh();
      },
      error: (err: { error?: unknown }) => {
        this.deleteInProgress.set(false);
        const msg = typeof err?.error === 'string' ? err.error : 'Could not delete plan.';
        this.messageService.add({ severity: 'error', summary: 'Delete failed', detail: msg });
      }
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatCellDate(value: unknown): string {
    const s = value != null && value !== '' ? String(value) : '';
    if (!s) return '—';
    return this.formatDate(s);
  }

  formatOptionalNumber(value: unknown): string {
    if (value == null || value === '') return '—';
    return String(value);
  }
}
