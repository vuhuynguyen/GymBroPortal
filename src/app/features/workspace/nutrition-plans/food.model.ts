/** API DTOs for `/api/foods` (camelCase JSON) — the food/supplement catalog the plan builder picks from. */

export type FoodKind = 'Food' | 'Supplement' | 'Beverage';

export interface FoodDto {
  id: string;
  name: string;
  brand: string | null;
  /** camelCase enum string on the wire (`food` / `supplement` / `beverage`). */
  kind: string;
  servingLabel: string;
  servingSizeGrams: number | null;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  isCustom: boolean;
}

export interface FoodListResponseDto {
  items: FoodDto[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * Body for `POST /api/foods/custom` (Owner perm `NutritionPlanCreate`, tenant-scoped) — creates a gym
 * catalog food. `kind` is the PascalCase enum string ("Food" | "Supplement" | "Beverage"); macros are
 * per serving. Returns the new food id (then re-readable via the catalog).
 */
export interface CreateCustomFoodRequest {
  name: string;
  kind: FoodKind;
  servingLabel: string;
  servingSizeGrams?: number;
  energyKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  brand?: string;
}

/** `POST /api/foods/custom` response — the created catalog food's id. */
export interface CreateCustomFoodResponse {
  id: string;
}
