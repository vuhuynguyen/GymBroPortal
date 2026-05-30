import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import { PageContainerComponent, PageHeaderComponent } from '../../../shared/ui';
import { TenantService } from '../../../core/tenant/tenant';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { WorkoutPlanService } from '../plans/workout-plan.service';
import type { MyPlanVisibilityMode } from '../plans/workout-plan.model';
import { PlanCardComponent } from './plan-card/plan-card';
import { TrainerPlansEmptyStateComponent } from './empty-state/empty-state';

export type TrainerPlanItem = {
  id: string;
  planId: string;
  name: string;
  coachName?: string;
  createdBySelf: boolean;
  daysPerWeek?: number;
  visibilityMode?: MyPlanVisibilityMode;
};

@Component({
  selector: 'app-trainer-plans',
  standalone: true,
  imports: [PageContainerComponent, PageHeaderComponent, PlanCardComponent, TrainerPlansEmptyStateComponent],
  templateUrl: './trainer-plans.html',
  styleUrl: './trainer-plans.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrainerPlansComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly tenantService = inject(TenantService);
  private readonly workoutPlanService = inject(WorkoutPlanService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  private readonly trainerId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('trainerId') ?? ''))
  );

  readonly loading = signal(false);
  readonly plans = signal<TrainerPlanItem[]>([]);

  readonly workspace = computed(() => {
    const id = this.trainerId();
    return this.tenantService.trainerWorkspaces().find((w) => w.id === id) ?? null;
  });

  readonly coachName = computed(() => this.workspace()?.ownerName || null);

  readonly emptyState = computed(() => {
    if (this.plans().length > 0) return null;
    return {
      title: 'No plans assigned yet',
      message: 'Your coach will assign a plan soon.',
      showCreateButton: false
    };
  });

  private lastLoadedTrainerId: string | null = null;

  constructor() {
    effect(() => {
      const id = this.trainerId()?.trim() ?? '';
      const tenants = this.tenantService.tenants();
      if (!id) {
        this.plans.set([]);
        this.lastLoadedTrainerId = null;
        return;
      }
      if (tenants.length === 0) return;
      if (!tenants.some((t) => t.id === id)) {
        this.plans.set([]);
        this.messageService.add({
          severity: 'warn',
          summary: 'Workspace not found',
          detail: 'You are not a member of this trainer workspace.'
        });
        void this.router.navigateByUrl('/workspace/logs');
        return;
      }
      if (this.lastLoadedTrainerId === id) return;
      this.tenantService.selectTrainerWorkspace(id);
      this.lastLoadedTrainerId = id;
      this.refresh();
    });
  }

  refresh(): void {
    this.loading.set(true);
    forkJoin({
      assigned: this.workoutPlanService.listMyAssignments(),
      mine: this.workoutPlanService.listMyPlans()
    }).subscribe({
      next: ({ assigned, mine }) => {
        const planNameById = new Map(mine.map((p) => [p.id, p.name]));
        const coach = this.coachName() ?? undefined;
        const assignedItems: TrainerPlanItem[] = assigned.map((plan) => ({
          id: plan.id,
          planId: plan.planId ?? '',
          name: plan.name?.trim() || planNameById.get(plan.planId ?? '') || 'Plan',
          coachName: plan.coachName ?? coach,
          createdBySelf: false,
          daysPerWeek: plan.daysPerWeek ?? undefined,
          visibilityMode: plan.visibilityMode ?? undefined
        }));
        this.plans.set(assignedItems);
        this.loading.set(false);
      },
      error: () => {
        this.plans.set([]);
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not load plans',
          detail: 'Please refresh and try again.'
        });
      }
    });
  }

  viewPlan(plan: TrainerPlanItem): void {
    if (plan.visibilityMode !== 'Full') {
      this.messageService.add({
        severity: 'info',
        summary: 'Plan locked',
        detail: 'Only plans with full visibility can be opened.'
      });
      return;
    }
    const targetPlanId = plan.planId.trim();
    if (!targetPlanId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot open plan',
        detail: 'Plan id is missing in assignment data. Please refresh and try again.'
      });
      return;
    }
    void this.router.navigate(['/workspace/plans', targetPlanId]);
  }
}
