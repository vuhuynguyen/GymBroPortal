/**
 * Pure, framework-free parsing/validation helpers for plan builder metadata.
 *
 * Extracted from PlanBuilderComponent so the meta bounds (2–4 weeks, 3–6
 * workouts/week) and chip rendering can be unit-tested without the reactive form.
 * The component reads raw control values and passes them here — behaviour is unchanged.
 */

/** Parse a value to an integer, or null when blank / non-integer. */
export function parseIntSafe(v: unknown): number | null {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

export interface PlanMeta {
  durationWeeks: number | null;
  workoutsPerWeek: number | null;
  error: string | null;
}

/**
 * Validate and normalize the plan's duration/frequency. Blank is allowed (→ null);
 * a present value outside its inclusive bound returns an `error` and clears both.
 */
export function parsePlanMeta(durationWeeksRaw: unknown, workoutsPerWeekRaw: unknown): PlanMeta {
  const dw = (durationWeeksRaw ?? '').toString().trim();
  const pw = (workoutsPerWeekRaw ?? '').toString().trim();

  let durationWeeks: number | null = null;
  if (dw) {
    const n = Number(dw);
    if (!Number.isInteger(n) || n < 2 || n > 4)
      return { durationWeeks: null, workoutsPerWeek: null, error: 'Duration weeks must be between 2 and 4.' };
    durationWeeks = n;
  }

  let workoutsPerWeek: number | null = null;
  if (pw) {
    const n = Number(pw);
    if (!Number.isInteger(n) || n < 3 || n > 6)
      return { durationWeeks: null, workoutsPerWeek: null, error: 'Workouts per week must be between 3 and 6.' };
    workoutsPerWeek = n;
  }

  return { durationWeeks, workoutsPerWeek, error: null };
}

export interface PlanMetaChip {
  icon: string;
  label: string;
}

/** Build the meta chips shown under the plan name; mirrors the save-time bounds. */
export function computePlanMetaChips(
  durationWeeksRaw: unknown,
  workoutsPerWeekRaw: unknown
): PlanMetaChip[] {
  const chips: PlanMetaChip[] = [];
  const dw = parseIntSafe(durationWeeksRaw);
  chips.push({
    icon: 'pi pi-calendar',
    label: dw != null && dw >= 1 ? `${dw} week${dw === 1 ? '' : 's'}` : '— weeks'
  });
  const pw = parseIntSafe(workoutsPerWeekRaw);
  chips.push({
    icon: 'pi pi-bolt',
    label: pw != null && pw >= 1 ? `${pw} workouts per week` : '— per week'
  });
  chips.push({ icon: 'pi pi-tag', label: 'Template (not assigned)' });
  return chips;
}
