/**
 * Pure, framework-free macro arithmetic for the nutrition plan builder — sibling of `plan-meta.ts`.
 *
 * A plan item's macros = the food's per-serving macros × the item quantity; meal subtotals sum their
 * items and the day total sums the meals. All-null inputs stay null (no fabricated zeros), so the UI
 * can render "—" for foods without macro data instead of a misleading 0.
 */

export interface MacroSet {
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
}

export const EMPTY_MACROS: MacroSet = {
  energyKcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  fiberG: null
};

const KEYS: (keyof MacroSet)[] = ['energyKcal', 'proteinG', 'carbsG', 'fatG', 'fiberG'];

/** Per-serving macros × quantity. Null macro stays null; non-finite/negative quantity → all null. */
export function scaleMacros(perServing: Partial<MacroSet> | null | undefined, quantity: number): MacroSet {
  const out: MacroSet = { ...EMPTY_MACROS };
  if (!perServing || !Number.isFinite(quantity) || quantity < 0) return out;
  for (const k of KEYS) {
    const v = perServing[k];
    out[k] = v == null ? null : round1(v * quantity);
  }
  return out;
}

/** Sum macro sets; a metric stays null only when it is null in every input. */
export function sumMacros(sets: ReadonlyArray<MacroSet>): MacroSet {
  const out: MacroSet = { ...EMPTY_MACROS };
  for (const s of sets) {
    for (const k of KEYS) {
      const v = s[k];
      if (v == null) continue;
      out[k] = round1((out[k] ?? 0) + v);
    }
  }
  return out;
}

/** Compact subtotal line, e.g. "650 kcal · P 42g · C 70g · F 18g". Omits null metrics; '' when all null. */
export function formatMacroLine(m: MacroSet): string {
  const parts: string[] = [];
  if (m.energyKcal != null) parts.push(`${fmt(m.energyKcal)} kcal`);
  if (m.proteinG != null) parts.push(`P ${fmt(m.proteinG)}g`);
  if (m.carbsG != null) parts.push(`C ${fmt(m.carbsG)}g`);
  if (m.fatG != null) parts.push(`F ${fmt(m.fatG)}g`);
  return parts.join(' · ');
}

/** Parse a quantity input: positive finite number, up to 2 decimals; null when blank/invalid. */
export function parseQuantity(v: unknown): number | null {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}
