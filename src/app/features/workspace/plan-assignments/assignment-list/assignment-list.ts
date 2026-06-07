import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ButtonComponent,
  DataTableCellTemplateDirective,
  DataTableComponent,
  type TableColumn
} from '../../../../shared/ui';
import type { PlanAssignmentSummaryDto } from '../plan-assignment.model';
import type { WorkoutPlanSummaryDto } from '../../plans/workout-plan.model';
import type { MemberDto } from '../../workspace.model';

@Component({
  selector: 'app-assignment-list',
  standalone: true,
  imports: [DataTableComponent, DataTableCellTemplateDirective, ButtonComponent],
  templateUrl: './assignment-list.html',
  styleUrl: './assignment-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentListComponent {
  readonly loading = input(false);
  readonly assignments = input<PlanAssignmentSummaryDto[]>([]);
  readonly plans = input<WorkoutPlanSummaryDto[]>([]);
  readonly trainees = input<MemberDto[]>([]);

  readonly editClicked = output<string>();
  readonly revokeClicked = output<string>();
  readonly applyLatestClicked = output<string>();
  readonly pauseToggled = output<{ id: string; active: boolean }>();

  readonly columns: TableColumn[] = [
    { field: 'trainee', header: 'Trainee', filter: true, filterType: 'text' },
    { field: 'plan', header: 'Plan', filter: true, filterType: 'text' },
    { field: 'version', header: 'Version', filter: false },
    { field: 'visibility', header: 'Visibility', filter: true, filterType: 'text' },
    { field: 'status', header: 'Status', type: 'custom', filter: false },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  readonly rowData = computed(() =>
    this.assignments().map((a) => ({
      id: a.id,
      trainee: this.traineeName(a.traineeId),
      plan: this.planName(a.planId),
      version: `v${a.planVersion}`,
      visibility: a.visibilityMode,
      hasNewerVersion: a.hasNewerVersion,
      latestPlanVersion: a.latestPlanVersion,
      isActive: a.isActive
    }))
  );

  traineeName(traineeId: string): string {
    return this.trainees().find((x) => x.userId === traineeId)?.name ?? 'Unknown trainee';
  }

  planName(planId: string): string {
    return this.plans().find((x) => x.id === planId)?.name ?? 'Plan';
  }

}
