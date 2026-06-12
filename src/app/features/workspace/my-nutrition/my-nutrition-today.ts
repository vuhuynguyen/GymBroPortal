/**
 * Pure, framework-free transforms for the self-logging "My Nutrition" Today surface — the web mirror of
 * the Flutter `TodayNutritionController` optimistic helpers. Extracted so the apply-immediately /
 * roll-back-on-error logic (status toggle, substitute, off-plan add, remove) and the meal-slot options
 * are unit-testable without the component or HttpClient.
 */

import type { FoodDto } from '../nutrition-plans/food.model';
import {
  STANDARD_MEAL_NAMES,
  loggedItemStatusToLabel,
  type LoggedItemStatusLabel
} from '../nutrition-plans/nutrition-enums';
import { sumMacros, type MacroSet } from '../nutrition-plans/nutrition-macros';
import type {
  DailyNutritionLogDto,
  LoggedItemDto,
  LoggedMealDto
} from '../client-nutrition/nutrition-log.model';

/** Standard meal slots offered for off-plan logging even when no plan is assigned (shared constant). */
export const STANDARD_MEALS = STANDARD_MEAL_NAMES;

/** Synthetic bucket name an off-plan add lands in when no meal slot is chosen. */
export const OFF_PLAN_MEAL = 'Off-plan';

/** True when the day is locked (server marks unlogged items missed) — no writes allowed. */
export function isDayClosed(log: Pick<DailyNutritionLogDto, 'status'>): boolean {
  return String(log.status ?? '').toLowerCase() === 'closed';
}

/**
 * Meal slots to offer under "Log under": the day's own meals first (a plan may use custom names), then
 * the standard slots, de-duplicated, so the user can always pick Breakfast/Lunch/Dinner/Snack.
 */
export function mealOptions(log: Pick<DailyNutritionLogDto, 'meals'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (name: string): void => {
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  };
  for (const m of log.meals ?? []) add(m.name);
  for (const m of STANDARD_MEALS) add(m);
  return out;
}

/**
 * Next status for a one-tap toggle on the leading control. A planned item completes; a completed
 * planned item un-completes back to planned; an ad-hoc item (logged as eaten, never "planned") toggles
 * completed ↔ skipped instead — the server rejects setting an ad-hoc item back to Planned.
 */
export function nextToggleStatus(item: Pick<LoggedItemDto, 'status' | 'isPlanned'>): 'completed' | 'skipped' | 'planned' {
  const status = loggedItemStatusToLabel(item.status);
  if (status === 'Completed' || status === 'Substituted') {
    return item.isPlanned ? 'planned' : 'skipped';
  }
  return 'completed';
}

/** Immutably replace one item (matched by id) across all meals via the transform. */
export function withItem(
  log: DailyNutritionLogDto,
  itemId: string,
  transform: (item: LoggedItemDto) => LoggedItemDto
): DailyNutritionLogDto {
  return {
    ...log,
    meals: (log.meals ?? []).map((meal) => ({
      ...meal,
      items: meal.items.map((i) => (i.id === itemId ? transform(i) : i))
    }))
  };
}

/** Optimistic status change on an item (used before the network confirms). */
export function applyStatus(
  log: DailyNutritionLogDto,
  itemId: string,
  status: 'completed' | 'skipped' | 'planned'
): DailyNutritionLogDto {
  const label = statusToLabel(status);
  return recount(withItem(log, itemId, (i) => ({ ...i, status: label })));
}

/** Optimistic substitution: swap the item's food + macros, mark Substituted. */
export function applySubstitute(
  log: DailyNutritionLogDto,
  itemId: string,
  food: FoodDto,
  quantity: number
): DailyNutritionLogDto {
  return recount(
    withItem(log, itemId, (i) => ({
      ...i,
      status: 'substituted',
      foodId: food.id,
      foodName: food.name,
      kind: food.kind,
      servingLabel: food.servingLabel ?? i.servingLabel,
      quantity,
      energyKcal: food.energyKcal,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      fiberG: food.fiberG
    }))
  );
}

/** Build the optimistic ad-hoc item row (a local id stands in until the server reload returns the real one). */
export function buildAdhocItem(food: FoodDto, quantity: number, localId: string): LoggedItemDto {
  return {
    id: localId,
    planMealItemId: null,
    isPlanned: false,
    foodId: food.isCustom ? null : food.id,
    kind: food.kind,
    foodName: food.name,
    servingLabel: food.servingLabel,
    quantity,
    energyKcal: food.energyKcal,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    fiberG: food.fiberG,
    status: 'completed',
    loggedAtUtc: new Date().toISOString(),
    note: null
  };
}

/** Optimistically append an off-plan item into [mealName] (creating the bucket if absent). */
export function applyAddAdhoc(
  log: DailyNutritionLogDto,
  item: LoggedItemDto,
  mealName: string
): DailyNutritionLogDto {
  const meals = log.meals ?? [];
  const exists = meals.some((m) => m.name === mealName);
  const next: LoggedMealDto[] = meals.map((m) =>
    m.name === mealName ? { ...m, items: [...m.items, item] } : m
  );
  if (!exists) next.push({ name: mealName, scheduledTime: null, items: [item] });
  return recount({ ...log, meals: next });
}

/** Optimistically drop an item (ad-hoc removal) from every meal. */
export function applyRemove(log: DailyNutritionLogDto, itemId: string): DailyNutritionLogDto {
  return recount({
    ...log,
    meals: (log.meals ?? []).map((m) => ({
      ...m,
      items: m.items.filter((i) => i.id !== itemId)
    }))
  });
}

/** Macros actually consumed today (Completed / Substituted items only). */
export function consumedMacros(log: Pick<DailyNutritionLogDto, 'meals'>): MacroSet {
  const items = (log.meals ?? []).flatMap((m) => m.items);
  const eaten = items.filter((i) => {
    const s = loggedItemStatusToLabel(i.status);
    return s === 'Completed' || s === 'Substituted';
  });
  return sumMacros(
    eaten.map((i) => ({
      energyKcal: scale(i.energyKcal, i.quantity),
      proteinG: scale(i.proteinG, i.quantity),
      carbsG: scale(i.carbsG, i.quantity),
      fatG: scale(i.fatG, i.quantity),
      fiberG: scale(i.fiberG, i.quantity)
    }))
  );
}

/**
 * Recompute the plan-relative roll-up counts after an optimistic edit so the adherence ring tracks the
 * tap immediately. Planned count = items that are planned; completed = planned items that are
 * Completed/Substituted; adherence = completed / planned. Ad-hoc items don't move the ring.
 */
function recount(log: DailyNutritionLogDto): DailyNutritionLogDto {
  const items = (log.meals ?? []).flatMap((m) => m.items);
  const planned = items.filter((i) => i.isPlanned);
  const completed = planned.filter((i) => {
    const s = loggedItemStatusToLabel(i.status);
    return s === 'Completed' || s === 'Substituted';
  });
  const plannedCount = planned.length;
  const completedCount = completed.length;
  const adherencePct = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;
  return { ...log, plannedCount, completedCount, adherencePct };
}

function statusToLabel(status: 'completed' | 'skipped' | 'planned'): string {
  return status;
}

function scale(value: number | null, quantity: number): number | null {
  if (value == null) return null;
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  return value * q;
}

export type { LoggedItemStatusLabel };
