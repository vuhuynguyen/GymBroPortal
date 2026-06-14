/**
 * Timezone helpers. The user's authoritative zone lives server-side (`User.TimeZoneId`, minted into the JWT
 * `tz` claim so handlers resolve day boundaries without a per-request parameter). The client's only jobs are to
 * (1) report its current device zone so that anchor stays in step, and (2) render ANOTHER trainee's data in the
 * trainee's captured zone (coach views). A trainee's own data renders in the device zone implicitly — pass no
 * `zone` and `Intl` uses the device default.
 */

/** The device's IANA zone, e.g. "America/Toronto". UTC fallback when unavailable. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** The calendar year/month/day of an instant as seen in the given IANA zone (device zone when omitted). */
function zonedYmd(date: Date, zone?: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

/**
 * "Today" / "Yesterday" / "N days ago" / short date for an instant, with the day boundary computed in the given
 * zone — so a coach in another country sees the trainee's local day, not the viewer's. Falls back to the device
 * zone when `zone` is omitted or null.
 */
export function relativeDayInZone(
  value: string | null | undefined,
  zone?: string | null,
  now: Date = new Date()
): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const tz = zone ?? undefined;
  const today = zonedYmd(now, tz);
  const that = zonedYmd(date, tz);
  const diffDays = Math.round(
    (Date.UTC(today.year, today.month - 1, today.day) - Date.UTC(that.year, that.month - 1, that.day)) /
      86_400_000
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz });
}
