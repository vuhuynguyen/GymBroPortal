import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, PageContainerComponent, PageHeaderComponent } from '../shared/ui';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ButtonComponent, PageContainerComponent, PageHeaderComponent],
  template: `
    <div class="dashboard-page flex flex-col gap-inv-5">
      <app-ui-page-container class="flex flex-col gap-inv-5">
        <app-page-header
          title="Dashboard"
          subtitle="Overview of your GymBro workspace." />
        <div
          class="dashboard-welcome flex flex-col gap-inv-4 rounded-inv-lg border border-solid border-inv-border-card bg-inv-surface-base p-8 shadow-inv-card">
          <h2 class="dashboard-welcome__title">Welcome back</h2>
          <p class="dashboard-welcome__text">
            Manage exercises from the catalog or review activity from here.
          </p>
          <div>
            <app-button
              label="Go to exercises"
              icon="pi pi-arrow-right"
              iconPos="right"
              (clicked)="goExercises()" />
          </div>
        </div>
      </app-ui-page-container>
    </div>
  `,
  styles: `
    .dashboard-welcome__title {
      margin: 0;
      font-size: var(--inv-text-body-lg);
      font-weight: 600;
      color: var(--inv-grey-900);
    }

    .dashboard-welcome__text {
      margin: 0;
      font-size: var(--inv-text-body-md);
      line-height: 1.5;
      color: var(--inv-grey-600);
      max-width: 36rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  private readonly router = inject(Router);

  goExercises(): void {
    void this.router.navigateByUrl('/exercises');
  }
}
