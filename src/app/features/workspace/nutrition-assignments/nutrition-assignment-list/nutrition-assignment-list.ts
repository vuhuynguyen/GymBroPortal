import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ButtonComponent,
  DataTableCellTemplateDirective,
  DataTableComponent,
  type TableColumn
} from '../../../../shared/ui';
import type { NutritionAssignmentSummaryDto } from '../nutrition-assignment.model';
import type { MemberDto } from '../../workspace.model';

/** Nutrition assignment table — clone of `assignment-list` (edit / revoke / pause row actions). */
@Component({
  selector: 'app-nutrition-assignment-list',
  standalone: true,
  imports: [DataTableComponent, DataTableCellTemplateDirective, ButtonComponent],
  templateUrl: './nutrition-assignment-list.html',
  styleUrl: './nutrition-assignment-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NutritionAssignmentListComponent {
  readonly loading = input(false);
  readonly assignments = input<NutritionAssignmentSummaryDto[]>([]);
  readonly trainees = input<MemberDto[]>([]);

  readonly editClicked = output<string>();
  readonly revokeClicked = output<string>();
  readonly pauseToggled = output<{ id: string; active: boolean }>();

  readonly columns: TableColumn[] = [
    { field: 'trainee', header: 'Trainee', filter: true, filterType: 'text' },
    { field: 'plan', header: 'Plan', filter: true, filterType: 'text' },
    { field: 'version', header: 'Version', filter: false },
    { field: 'period', header: 'Period', filter: false },
    { field: 'visibility', header: 'Visibility', filter: true, filterType: 'text' },
    { field: 'status', header: 'Status', type: 'custom', filter: false },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  readonly rowData = computed(() =>
    this.assignments().map((a) => ({
      id: a.id,
      trainee: this.traineeName(a.traineeId),
      plan: a.planName,
      version: `v${a.planVersion}`,
      period: this.period(a),
      visibility: a.visibilityMode,
      hideMacroTargets: a.hideMacroTargets,
      disableTraineeEditing: a.disableTraineeEditing,
      isActive: a.isActive
    }))
  );

  traineeName(traineeId: string): string {
    return this.trainees().find((x) => x.userId === traineeId)?.name ?? 'Unknown trainee';
  }

  private period(a: NutritionAssignmentSummaryDto): string {
    const fmt = (iso: string) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return a.endDate ? `${fmt(a.startDate)} – ${fmt(a.endDate)}` : `From ${fmt(a.startDate)}`;
  }
}
