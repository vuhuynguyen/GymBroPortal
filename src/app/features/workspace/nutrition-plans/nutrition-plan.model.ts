/** API DTOs for `/api/nutrition/plans` (camelCase JSON) — sibling of `workout-plan.model.ts`. */

import type { DayApplicabilityLabel } from './nutrition-enums';

export interface NutritionPlanSummaryDto {
  id: string;
  templateId: string;
  version: number;
  name: string;
  description: string | null;
  createdOnUtc: string;
  mealCount: number;
  isArchived: boolean;
  /** The head row is an unpublished draft (has edits not yet published). */
  isDraft: boolean;
  /** Latest published version of this template; null when never published (draft-only, not assignable). */
  latestPublishedVersion: number | null;
}

export interface NutritionPlanListResponseDto {
  items: NutritionPlanSummaryDto[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** A plan item carries the food macros denormalized at authoring time (per the food's serving). */
export interface PlanMealItemDto {
  id: string;
  foodId: string;
  order: number;
  quantity: number;
  foodName: string;
  servingLabel: string;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
}

export interface PlanMealDto {
  id: string;
  order: number;
  name: string;
  /** TimeOnly on the wire ("HH:mm:ss") — normalized via `scheduledTimeToInput`. */
  scheduledTime: string | null;
  /** camelCase enum string on the wire — normalized via `dayApplicabilityToLabel`. */
  dayApplicability: DayApplicabilityLabel | string;
  items: PlanMealItemDto[];
}

export interface NutritionPlanDetailDto {
  id: string;
  templateId: string;
  version: number;
  name: string;
  description: string | null;
  createdOnUtc: string;
  meals: PlanMealDto[];
  /** The head row is an unpublished draft (has edits not yet published). */
  isDraft: boolean;
  /** Latest published version of this template; null when never published. */
  latestPublishedVersion: number | null;
}

export interface CreateNutritionPlanRequest {
  name: string;
  description?: string | null;
}

/** PUT `/api/nutrition/plans/{id}/structure` — metadata + meals land as ONE new version. */
export interface NutritionPlanItemRequest {
  foodId: string;
  order: number;
  quantity: number;
}

export interface NutritionPlanMealRequest {
  name: string;
  order: number;
  /** "HH:mm:ss" or null. */
  scheduledTime: string | null;
  /** Wire int (API is int-tolerant in; see `dayApplicabilityToValue`). */
  dayApplicability: number;
  items: NutritionPlanItemRequest[];
}

export interface ReplaceNutritionPlanStructureRequest {
  name: string;
  description?: string | null;
  meals: NutritionPlanMealRequest[];
}

/** The structure PUT forks a new version and returns its id so the client re-points to the latest. */
export interface NutritionPlanVersionRef {
  id: string;
}
