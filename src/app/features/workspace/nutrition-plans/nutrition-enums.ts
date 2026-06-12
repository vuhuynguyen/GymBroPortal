/**
 * Single source of truth for the frontend nutrition enum mappings — mirrors of the API enums
 * `DayApplicability { EveryDay = 1, TrainingDay = 2, RestDay = 3 }` and
 * `NutritionVisibilityMode { Full = 1, Guided = 2, Blind = 3 }` (sibling of `shared/plan-visibility.ts`).
 * The API serializes enums as camelCase strings out and is case/int-tolerant in; like the workout
 * assignment flow we send the wire int and normalize the incoming string to a label.
 */

/**
 * Standard meal-slot names offered across the nutrition surfaces (plan builder name datalist + the
 * off-plan "Log under" fallback list), mirroring the Flutter fallback list. One source of truth so the
 * builder and the self-log surface stay in lock-step.
 */
export const STANDARD_MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;

/** Default name for a newly-added meal by 1-based position; extra meals fall back to "Snack"
 *  so the value is always one of the dropdown options. */
export function defaultMealName(position1Based: number): string {
  return STANDARD_MEAL_NAMES[position1Based - 1] ?? 'Snack';
}

export type DayApplicabilityLabel = 'EveryDay' | 'TrainingDay' | 'RestDay';

const DAY_VALUE_BY_LABEL: Record<DayApplicabilityLabel, number> = {
  EveryDay: 1,
  TrainingDay: 2,
  RestDay: 3
};

/** Label → wire int (for request bodies). */
export function dayApplicabilityToValue(label: DayApplicabilityLabel): number {
  return DAY_VALUE_BY_LABEL[label];
}

/** Normalize the API's camelCase enum string (or int) to a label; `null` if unrecognized. */
export function dayApplicabilityToLabel(value: unknown): DayApplicabilityLabel | null {
  switch (String(value).toLowerCase()) {
    case 'everyday':
    case '1':
      return 'EveryDay';
    case 'trainingday':
    case '2':
      return 'TrainingDay';
    case 'restday':
    case '3':
      return 'RestDay';
    default:
      return null;
  }
}

/** Human label for the day-applicability chip/select. */
export function dayApplicabilityDisplay(label: DayApplicabilityLabel): string {
  switch (label) {
    case 'TrainingDay':
      return 'Training days';
    case 'RestDay':
      return 'Rest days';
    default:
      return 'Every day';
  }
}

export type NutritionVisibilityModeLabel = 'Full' | 'Guided' | 'Blind';

const VISIBILITY_VALUE_BY_LABEL: Record<NutritionVisibilityModeLabel, number> = {
  Full: 1,
  Guided: 2,
  Blind: 3
};

/** Label → wire int (for request bodies). */
export function nutritionVisibilityToValue(mode: NutritionVisibilityModeLabel): number {
  return VISIBILITY_VALUE_BY_LABEL[mode];
}

/** Normalize the API's camelCase enum string (or int) to a label; `null` if unrecognized. */
export function nutritionVisibilityToLabel(value: unknown): NutritionVisibilityModeLabel | null {
  switch (String(value).toLowerCase()) {
    case 'full':
    case '1':
      return 'Full';
    case 'guided':
    case '2':
      return 'Guided';
    case 'blind':
    case '3':
      return 'Blind';
    default:
      return null;
  }
}

export type LoggedItemStatusLabel = 'Planned' | 'Completed' | 'Skipped' | 'Substituted' | 'Missed';

/** Normalize the API's camelCase `LoggedItemStatus` string to a label; defaults to `Planned`. */
export function loggedItemStatusToLabel(value: unknown): LoggedItemStatusLabel {
  switch (String(value).toLowerCase()) {
    case 'completed':
      return 'Completed';
    case 'skipped':
      return 'Skipped';
    case 'substituted':
      return 'Substituted';
    case 'missed':
      return 'Missed';
    default:
      return 'Planned';
  }
}

/**
 * Normalize a TimeOnly wire value ("HH:mm:ss" out of the API) to the "HH:mm" the time input uses.
 * Returns '' for null/unparseable values.
 */
export function scheduledTimeToInput(value: unknown): string {
  const s = String(value ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return '';
  const h = Number(m[1]);
  if (h > 23 || Number(m[2]) > 59) return '';
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** "HH:mm" input value → "HH:mm:ss" wire TimeOnly (or null when blank). */
export function scheduledTimeToWire(value: unknown): string | null {
  const s = scheduledTimeToInput(value);
  return s ? `${s}:00` : null;
}
