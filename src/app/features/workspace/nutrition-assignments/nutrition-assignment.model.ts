/** API DTOs for `/api/nutrition/assignments` (camelCase JSON) — sibling of `plan-assignment.model.ts`. */

import type { NutritionVisibilityModeLabel } from '../nutrition-plans/nutrition-enums';

export interface NutritionAssignmentSummaryDto {
  id: string;
  traineeId: string;
  planId: string;
  planVersion: number;
  /** Latest published version of the plan's template (equals planVersion when nothing newer is published). */
  latestPlanVersion: number;
  /** True when a newer published version exists — drives the "New vX" badge + apply-latest action. */
  hasNewerVersion: boolean;
  planName: string;
  /** ISO date (yyyy-MM-dd). */
  startDate: string;
  endDate: string | null;
  visibilityMode: NutritionVisibilityModeLabel;
  hideMacroTargets: boolean;
  disableTraineeEditing: boolean;
  isActive: boolean;
}

export interface NutritionAssignmentListResponseDto {
  items: NutritionAssignmentSummaryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface CreateNutritionAssignmentRequest {
  traineeId: string;
  planId: string;
  /** ISO date (yyyy-MM-dd). */
  startDate: string;
  endDate?: string | null;
  visibilityMode: NutritionVisibilityModeLabel;
  hideMacroTargets: boolean;
  disableTraineeEditing: boolean;
}

export interface UpdateNutritionAssignmentRequest {
  /** ISO date (yyyy-MM-dd). */
  startDate?: string;
  endDate?: string | null;
  visibilityMode: NutritionVisibilityModeLabel;
  hideMacroTargets: boolean;
  disableTraineeEditing: boolean;
}
