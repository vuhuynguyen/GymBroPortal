import {
  STANDARD_MEALS,
  OFF_PLAN_MEAL,
  applyAddAdhoc,
  applyRemove,
  applyStatus,
  applySubstitute,
  buildAdhocItem,
  consumedMacros,
  isDayClosed,
  mealOptions,
  nextToggleStatus,
  withItem
} from './my-nutrition-today';
import type { DailyNutritionLogDto, LoggedItemDto } from '../client-nutrition/nutrition-log.model';
import type { FoodDto } from '../nutrition-plans/food.model';

function item(over: Partial<LoggedItemDto> = {}): LoggedItemDto {
  return {
    id: 'i1',
    planMealItemId: 'pmi1',
    isPlanned: true,
    foodId: 'f1',
    kind: 'food',
    foodName: 'Oats',
    servingLabel: '1 bowl',
    quantity: 1,
    energyKcal: 200,
    proteinG: 8,
    carbsG: 30,
    fatG: 4,
    fiberG: 5,
    status: 'planned',
    loggedAtUtc: null,
    note: null,
    ...over
  };
}

function log(items: LoggedItemDto[]): DailyNutritionLogDto {
  return {
    id: 'log1',
    traineeId: 't1',
    localDate: '2026-06-12',
    status: 'open',
    source: 'plan',
    hasPlan: true,
    adherencePct: 0,
    plannedCount: 0,
    completedCount: 0,
    meals: [{ name: 'Breakfast', scheduledTime: '08:00:00', items }]
  };
}

const food: FoodDto = {
  id: 'f9',
  name: 'Banana',
  brand: null,
  kind: 'food',
  servingLabel: '1 medium',
  servingSizeGrams: 118,
  energyKcal: 105,
  proteinG: 1,
  carbsG: 27,
  fatG: 0,
  fiberG: 3,
  isCustom: false
};

describe('my-nutrition-today', () => {
  it('detects a closed day case-insensitively', () => {
    expect(isDayClosed({ status: 'closed' })).toBeTrue();
    expect(isDayClosed({ status: 'Closed' })).toBeTrue();
    expect(isDayClosed({ status: 'open' })).toBeFalse();
  });

  it('offers the day meals first then the de-duplicated standard slots', () => {
    const opts = mealOptions({ meals: [{ name: 'Pre-workout', scheduledTime: null, items: [] }] });
    expect(opts[0]).toBe('Pre-workout');
    for (const slot of STANDARD_MEALS) expect(opts).toContain(slot);
    // Breakfast appears once even if a plan meal already used that name.
    const dedup = mealOptions({ meals: [{ name: 'Breakfast', scheduledTime: null, items: [] }] });
    expect(dedup.filter((m) => m === 'Breakfast').length).toBe(1);
  });

  it('toggles planned vs ad-hoc items to the right next status', () => {
    expect(nextToggleStatus({ status: 'planned', isPlanned: true })).toBe('completed');
    expect(nextToggleStatus({ status: 'completed', isPlanned: true })).toBe('planned');
    expect(nextToggleStatus({ status: 'substituted', isPlanned: true })).toBe('planned');
    // An ad-hoc completed item can't go back to "planned" — it toggles to skipped.
    expect(nextToggleStatus({ status: 'completed', isPlanned: false })).toBe('skipped');
    expect(nextToggleStatus({ status: 'skipped', isPlanned: false })).toBe('completed');
  });

  it('replaces a single item by id immutably', () => {
    const l = log([item({ id: 'a' }), item({ id: 'b' })]);
    const next = withItem(l, 'b', (i) => ({ ...i, foodName: 'Changed' }));
    expect(next).not.toBe(l);
    expect(next.meals[0].items[0].foodName).toBe('Oats');
    expect(next.meals[0].items[1].foodName).toBe('Changed');
  });

  it('recounts adherence after an optimistic status change', () => {
    const l = log([item({ id: 'a' }), item({ id: 'b' })]);
    const after = applyStatus(l, 'a', 'completed');
    expect(after.plannedCount).toBe(2);
    expect(after.completedCount).toBe(1);
    expect(after.adherencePct).toBe(50);
    expect(after.meals[0].items[0].status).toBe('completed');
  });

  it('substitutes a planned item swapping its food + macros', () => {
    const l = log([item({ id: 'a' })]);
    const after = applySubstitute(l, 'a', food, 2);
    const swapped = after.meals[0].items[0];
    expect(swapped.status).toBe('substituted');
    expect(swapped.foodName).toBe('Banana');
    expect(swapped.foodId).toBe('f9');
    expect(swapped.quantity).toBe(2);
    // A substituted planned item counts as completed for adherence.
    expect(after.completedCount).toBe(1);
    expect(after.adherencePct).toBe(100);
  });

  it('builds an ad-hoc item that is completed and unplanned', () => {
    const built = buildAdhocItem(food, 1, 'local-1');
    expect(built.id).toBe('local-1');
    expect(built.isPlanned).toBeFalse();
    expect(built.status).toBe('completed');
    expect(built.foodId).toBe('f9');
    // A custom food's id is dropped (no catalog row).
    const custom = buildAdhocItem({ ...food, isCustom: true }, 1, 'local-2');
    expect(custom.foodId).toBeNull();
  });

  it('appends an ad-hoc item into an existing meal and creates a new bucket otherwise', () => {
    const l = log([item({ id: 'a' })]);
    const built = buildAdhocItem(food, 1, 'local-1');
    const inExisting = applyAddAdhoc(l, built, 'Breakfast');
    expect(inExisting.meals[0].items.length).toBe(2);

    const inNew = applyAddAdhoc(l, built, OFF_PLAN_MEAL);
    expect(inNew.meals.some((m) => m.name === OFF_PLAN_MEAL)).toBeTrue();
    // Ad-hoc items don't move plan-relative counts.
    expect(inNew.plannedCount).toBe(1);
    expect(inNew.completedCount).toBe(0);
  });

  it('removes an item from every meal', () => {
    const l = log([item({ id: 'a' }), item({ id: 'b', isPlanned: false, status: 'completed' })]);
    const after = applyRemove(l, 'b');
    expect(after.meals[0].items.map((i) => i.id)).toEqual(['a']);
  });

  it('sums consumed macros over completed + substituted items only', () => {
    const l = log([
      item({ id: 'a', status: 'completed', energyKcal: 200, proteinG: 8 }),
      item({ id: 'b', status: 'substituted', quantity: 2, energyKcal: 100, proteinG: 5 }),
      item({ id: 'c', status: 'skipped', energyKcal: 500, proteinG: 50 }),
      item({ id: 'd', status: 'planned', energyKcal: 999, proteinG: 99 })
    ]);
    const macros = consumedMacros(l);
    // a: 200 + b: 100*2 = 200 → 400 kcal; protein 8 + 5*2 = 18.
    expect(macros.energyKcal).toBe(400);
    expect(macros.proteinG).toBe(18);
  });
});
