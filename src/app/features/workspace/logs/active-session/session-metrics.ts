import type { PerformedExerciseDto } from '../session.model';

/**
 * Pure, framework-free metric + formatting helpers for the active-session screen.
 *
 * These were extracted from ActiveSessionComponent so the timer math and set
 * aggregation can be unit-tested without instantiating the component, its signals,
 * or change detection. The component keeps its computed signals and delegates the
 * arithmetic here — behaviour is unchanged.
 */

/** Format elapsed seconds as `H:MM:SS`, or `MM:SS` when under an hour. */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const m = String(mins).padStart(2, '0');
  const s = String(secs).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${m}:${s}` : `${m}:${s}`;
}

/** Format rest seconds as `M:SS` (minutes are not zero-padded). */
export function formatRestClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Elapsed whole seconds derived from wall-clock anchors rather than blind +1 ticks,
 * so the timer self-corrects after a tab sleep. Never negative.
 */
export function computeElapsedSeconds(startMs: number, nowMs: number, pausedOffsetMs: number): number {
  return Math.max(0, Math.floor((nowMs - startMs - pausedOffsetMs) / 1000));
}

/**
 * Total number of logged sets across all performed exercises. Every set counts, incl. drop stages, so
 * progress matches plans that prescribe drops as separate sets (RP 6-4-3-2 = working + 3 drops).
 */
export function countLoggedSets(exercises: readonly PerformedExerciseDto[]): number {
  return exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
}

/** Working-set volume (Σ weight × reps) over *completed* sets only, in kg. */
export function sumCompletedVolumeKg(exercises: readonly PerformedExerciseDto[]): number {
  return exercises.reduce(
    (sum, ex) =>
      sum +
      ex.sets.reduce((s, set) => {
        if (!set.isCompleted) return s;
        return s + (set.weightKg ?? 0) * (set.reps ?? 0);
      }, 0),
    0
  );
}

/** Mean RPE over completed sets that carry an RPE, rounded to 1 dp; null when none. */
export function averageCompletedRpe(exercises: readonly PerformedExerciseDto[]): number | null {
  const rpes: number[] = [];
  for (const ex of exercises) {
    for (const set of ex.sets) {
      if (set.isCompleted && set.rpe != null) rpes.push(set.rpe);
    }
  }
  if (rpes.length === 0) return null;
  return Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10;
}

/**
 * Effective set count for an exercise: the highest of its planned sets, its logged
 * sets (plus the in-progress entry row when this is the active exercise), and 1.
 */
export function resolveTargetSetCount(
  loggedCount: number,
  plannedCount: number,
  includeActiveRow: boolean
): number {
  if (includeActiveRow) return Math.max(plannedCount, loggedCount + 1, 1);
  return Math.max(plannedCount, loggedCount);
}

/**
 * An exercise is complete once its completed-set count reaches the planned count.
 * With no plan (`plannedCount == null`) the logged-set count is the bar; a planned
 * count of 0 is never "complete".
 */
export function isPerformedExerciseComplete(
  ex: PerformedExerciseDto,
  plannedCount: number | null
): boolean {
  // Count every set incl. drop stages, matching the prescription (which lists drops as separate sets).
  const planned = plannedCount ?? ex.sets.length;
  if (planned === 0) return false;
  return ex.sets.filter((s) => s.isCompleted).length >= planned;
}

/** Logged/total as a clamped 0–100 integer percentage; 0 when there is no total. */
export function computeProgressPercent(logged: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((logged / total) * 100));
}
