import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ButtonComponent,
  ConfirmSplitDialogComponent,
  DataTableCellTemplateDirective,
  DataTableComponent,
  PageContainerComponent,
  PageHeaderComponent,
  type TableColumn
} from '../../../../shared/ui';
import { NutritionPlanService } from '../nutrition-plan.service';
import type { NutritionPlanSummaryDto } from '../nutrition-plan.model';
import { NutritionAssignmentService } from '../../nutrition-assignments/nutrition-assignment.service';
import {
  NutritionPlanDetailsDialogComponent,
  type NutritionPlanDetailsFormValue
} from '../nutrition-plan-details-dialog/nutrition-plan-details-dialog';
import { CoachPlanListBase, type PlanListPort } from '../../shared/coach-plan-list-base';

/** Coach nutrition plan list — thin config over {@link CoachPlanListBase} against `/api/nutrition/plans`. */
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
export class NutritionPlansListComponent extends CoachPlanListBase<NutritionPlanSummaryDto> {
  private readonly nutritionPlanService = inject(NutritionPlanService);
  private readonly assignmentService = inject(NutritionAssignmentService);

  readonly createInitial: NutritionPlanDetailsFormValue = { name: '', description: '' };

  readonly tableColumns: TableColumn[] = [
    { field: 'name', header: 'Name', type: 'custom', filter: true, filterType: 'text' },
    { field: 'description', header: 'Description', filter: true, filterType: 'text' },
    { field: 'mealCount', header: 'Meals', filter: false },
    { field: 'version', header: 'Version', filter: false },
    { field: 'createdOnUtc', header: 'Created', type: 'custom', filter: false },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  protected readonly port: PlanListPort<NutritionPlanSummaryDto> = {
    list: (q) => this.nutritionPlanService.list(q),
    archive: (id) => this.nutritionPlanService.archive(id),
    unarchive: (id) => this.nutritionPlanService.unarchive(id),
    delete: (id) => this.nutritionPlanService.delete(id),
    mapRow: (p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      mealCount: p.mealCount,
      version: `v${p.version}`,
      createdOnUtc: p.createdOnUtc,
      isArchived: p.isArchived,
      isDraft: p.isDraft
    }),
    selfAssign: (planId, userId) => {
      const today = new Date().toLocaleDateString('en-CA');
      return this.assignmentService.create({
        traineeId: userId,
        planId,
        startDate: today,
        endDate: null,
        visibilityMode: 'Full',
        hideMacroTargets: false,
        disableTraineeEditing: false
      });
    },
    editRouteBase: '/workspace/nutrition-plans',
    nouns: {
      loadFailure: 'nutrition plans',
      createFailure: 'nutrition plan',
      deleteFailure: 'nutrition plan',
      createdDetail: 'Plan appears in the list. Click Edit to open the meal builder.',
      deletedDetail: 'Nutrition plan removed.',
      deleteEntity: 'nutrition plan',
      navBlockedDetail: 'Could not open the meal builder.'
    },
    selfAssignCopy: {
      cannotSummary: 'Cannot assign',
      successSummary: 'Assigned to you',
      successDetail: 'Find it any time on your My Nutrition page.',
      duplicateDetail: 'You are already following this nutrition plan.',
      errorDetail: 'Could not add this plan to your nutrition.'
    }
  };

  constructor() {
    super();
  }

  /** Use this plan myself — self-assign with full visibility (template binding). */
  useThisMyself(row: Record<string, unknown>): void {
    this.selfAssign(row);
  }

  onCreateDialogSaved(v: NutritionPlanDetailsFormValue): void {
    this.submitCreate(
      this.nutritionPlanService.create({ name: v.name.trim(), description: v.description?.trim() || null })
    );
  }
}
