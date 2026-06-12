/**
 * Pure, framework-free presentation helpers for the coach nutrition adherence view — sibling of
 * `session-metrics.ts`. Extracted so adherence tone bucketing and day labels are unit-testable
 * without the component.
 */

export type AdherenceTone = 'good' | 'ok' | 'low' | 'none';

/** Bucket an adherence % into the tone used for the ring/badge color. */
export function adherenceTone(pct: number, plannedCount: number): AdherenceTone {
  if (plannedCount <= 0) return 'none';
  if (pct >= 80) return 'good';
  if (pct >= 50) return 'ok';
  return 'low';
}

/** Clamp the API adherence % into a safe 0–100 integer for display. */
export function clampAdherencePct(pct: unknown): number {
  const n = Number(pct);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** "Today" / "Yesterday" / "N days ago" / "Mon DD" for an ISO local date (yyyy-MM-dd). */
export function relativeDayLabel(isoDate: string, today: Date = new Date()): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return '';
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = Math.round((startOfToday - parsed.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "X of Y meals logged" summary line; '' when the day has no plan. */
export function completionLine(completedCount: number, plannedCount: number): string {
  if (plannedCount <= 0) return '';
  return `${completedCount} of ${plannedCount} item${plannedCount === 1 ? '' : 's'} done`;
}

function parseIsoDate(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate ?? '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
