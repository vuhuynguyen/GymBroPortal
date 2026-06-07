/**
 * Single source of truth for the frontend plan-visibility mapping — mirror of the API enum
 * `PlanVisibilityMode { Full = 1, Guided = 2, Blind = 3 }`. Previously the `1/2/3` mapping was
 * duplicated in WorkoutPlanService and PlanAssignmentService, which would drift if the API renumbered.
 */
export type VisibilityModeLabel = 'Full' | 'Guided' | 'Blind';

const VALUE_BY_LABEL: Record<VisibilityModeLabel, number> = { Full: 1, Guided: 2, Blind: 3 };

/** Label → wire int (for request bodies). */
export function visibilityModeToValue(mode: VisibilityModeLabel): number {
  return VALUE_BY_LABEL[mode];
}

/**
 * Normalize a label or wire int (as the API may send either) to a label; `null` if unrecognized.
 * Callers apply their own default (e.g. `?? 'Guided'`, or keep `null` when visibility is absent).
 */
export function visibilityModeToLabel(value: unknown): VisibilityModeLabel | null {
  if (value === 'Full' || value === 1) return 'Full';
  if (value === 'Guided' || value === 2) return 'Guided';
  if (value === 'Blind' || value === 3) return 'Blind';
  return null;
}
