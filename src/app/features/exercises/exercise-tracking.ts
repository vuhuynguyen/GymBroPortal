/**
 * Frontend mirror of the API's `ExerciseTrackingRules` (BuildingBlocks.Shared.Tracking). Single source of truth for
 * which metrics a tracking mode shows and requires — shared by the plan builder and the session logger so neither
 * hardcodes the strength shape. Keep in sync with the C# matrix.
 */
export const EXERCISE_TRACKING_TYPES = [
  'Strength',
  'Bodyweight',
  'Cardio',
  'Timed',
  'Hiit',
  'Mobility',
  'Custom',
] as const;
export type ExerciseTrackingType = (typeof EXERCISE_TRACKING_TYPES)[number];

export type TrackingMetric =
  | 'reps'
  | 'weight'
  | 'duration'
  | 'distance'
  | 'rounds'
  | 'rest'
  | 'rpe'
  | 'calories'
  | 'heartRate';

export interface TrackingProfile {
  type: ExerciseTrackingType;
  /** Essential set-entry inputs shown by default (kept to 1–2 so the card stays clean). */
  fields: TrackingMetric[];
  /** Secondary inputs (calories / heart rate / rest / rpe) revealed behind a "More" toggle. */
  extras: TrackingMetric[];
  /** At least one must be present to log a set (empty = no metric required). */
  primary: TrackingMetric[];
  /** A metric-less set that is marked completed is valid (mark-done). */
  allowCompletionOnly: boolean;
  /** Plan-builder target inputs to show, in display order. */
  targetFields: TrackingMetric[];
}

const PROFILES: Record<ExerciseTrackingType, TrackingProfile> = {
  Strength: {
    type: 'Strength',
    fields: ['weight', 'reps'],
    extras: ['rest', 'rpe'],
    primary: ['reps'],
    allowCompletionOnly: false,
    targetFields: ['reps', 'weight', 'rpe'],
  },
  Bodyweight: {
    type: 'Bodyweight',
    fields: ['reps', 'weight'],
    extras: ['rest', 'rpe'],
    primary: ['reps'],
    allowCompletionOnly: false,
    targetFields: ['reps', 'weight', 'rpe'],
  },
  Cardio: {
    type: 'Cardio',
    fields: ['duration', 'distance'],
    extras: ['calories', 'heartRate', 'rest', 'rpe'],
    primary: ['duration', 'distance'],
    allowCompletionOnly: false,
    targetFields: ['duration', 'distance'],
  },
  Timed: {
    type: 'Timed',
    fields: ['duration'],
    extras: ['rest', 'rpe'],
    primary: ['duration'],
    allowCompletionOnly: false,
    targetFields: ['duration'],
  },
  Hiit: {
    type: 'Hiit',
    fields: ['rounds', 'duration'],
    extras: ['calories', 'heartRate', 'rest', 'rpe'],
    primary: ['rounds', 'duration'],
    allowCompletionOnly: false,
    targetFields: ['rounds', 'duration'],
  },
  Mobility: {
    type: 'Mobility',
    fields: ['duration', 'reps'],
    extras: ['rest'],
    primary: [],
    allowCompletionOnly: true,
    targetFields: ['duration', 'reps'],
  },
  Custom: {
    type: 'Custom',
    fields: ['reps', 'weight', 'duration', 'distance', 'rounds'],
    extras: ['calories', 'heartRate', 'rest', 'rpe'],
    primary: ['reps', 'weight', 'duration', 'distance', 'rounds'],
    allowCompletionOnly: true,
    targetFields: ['reps', 'weight', 'duration', 'distance', 'rounds'],
  },
};

export function trackingProfile(type: string | null | undefined): TrackingProfile {
  const key = (type ?? 'Strength') as ExerciseTrackingType;
  return PROFILES[key] ?? PROFILES.Strength;
}

/** Set-entry metric values to test against a mode's primary-metric rule. */
export interface SetMetricValues {
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  distanceM?: number | null;
  rounds?: number | null;
  isCompleted?: boolean;
}

/** True when the values carry at least the primary metric for the mode (mirrors the server rule). */
export function hasRequiredMetric(type: string | null | undefined, v: SetMetricValues): boolean {
  const profile = trackingProfile(type);
  if (profile.allowCompletionOnly && v.isCompleted) return true;
  if (profile.primary.length === 0) return true;

  const present = new Set<TrackingMetric>();
  if ((v.reps ?? 0) > 0) present.add('reps');
  if ((v.weightKg ?? 0) > 0) present.add('weight');
  if ((v.durationSeconds ?? 0) > 0) present.add('duration');
  if ((v.distanceM ?? 0) > 0) present.add('distance');
  if ((v.rounds ?? 0) > 0) present.add('rounds');

  return profile.primary.some((m) => present.has(m));
}

/** User-facing hint describing what a set of this mode needs (mirrors the server message). */
export function requiredMetricMessage(type: string | null | undefined): string {
  switch (trackingProfile(type).type) {
    case 'Strength':
    case 'Bodyweight':
      return 'Enter reps to log this set.';
    case 'Cardio':
      return 'Enter a duration or distance to log this set.';
    case 'Timed':
      return 'Enter a duration to log this set.';
    case 'Hiit':
      return 'Enter rounds or a work duration to log this set.';
    case 'Mobility':
      return 'Mark the set completed or enter a duration.';
    default:
      return 'Enter at least one metric to log this set.';
  }
}
