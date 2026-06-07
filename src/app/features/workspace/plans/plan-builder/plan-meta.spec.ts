import { computePlanMetaChips, parseIntSafe, parsePlanMeta } from './plan-meta';

describe('parseIntSafe', () => {
  it('parses integer-like strings', () => {
    expect(parseIntSafe('3')).toBe(3);
    expect(parseIntSafe(4)).toBe(4);
  });

  it('returns null for blank, non-integer, or non-numeric values', () => {
    expect(parseIntSafe('')).toBeNull();
    expect(parseIntSafe('  ')).toBeNull();
    expect(parseIntSafe('2.5')).toBeNull();
    expect(parseIntSafe('abc')).toBeNull();
    expect(parseIntSafe(null)).toBeNull();
    expect(parseIntSafe(undefined)).toBeNull();
  });
});

describe('parsePlanMeta', () => {
  it('accepts blank values as null with no error', () => {
    expect(parsePlanMeta('', '')).toEqual({ durationWeeks: null, workoutsPerWeek: null, error: null });
  });

  it('accepts in-bound values', () => {
    expect(parsePlanMeta('2', '3')).toEqual({ durationWeeks: 2, workoutsPerWeek: 3, error: null });
    expect(parsePlanMeta('4', '6')).toEqual({ durationWeeks: 4, workoutsPerWeek: 6, error: null });
  });

  it('rejects duration weeks outside 2–4', () => {
    expect(parsePlanMeta('1', '3').error).toBe('Duration weeks must be between 2 and 4.');
    expect(parsePlanMeta('5', '3').error).toBe('Duration weeks must be between 2 and 4.');
  });

  it('rejects workouts per week outside 3–6', () => {
    expect(parsePlanMeta('2', '2').error).toBe('Workouts per week must be between 3 and 6.');
    expect(parsePlanMeta('2', '7').error).toBe('Workouts per week must be between 3 and 6.');
  });

  it('rejects non-integers', () => {
    expect(parsePlanMeta('2.5', '3').error).toBe('Duration weeks must be between 2 and 4.');
  });

  it('clears both values when there is an error', () => {
    expect(parsePlanMeta('99', '4')).toEqual({
      durationWeeks: null,
      workoutsPerWeek: null,
      error: 'Duration weeks must be between 2 and 4.'
    });
  });
});

describe('computePlanMetaChips', () => {
  it('renders week/per-week labels and the static template chip', () => {
    const chips = computePlanMetaChips('2', '4');
    expect(chips).toEqual([
      { icon: 'pi pi-calendar', label: '2 weeks' },
      { icon: 'pi pi-bolt', label: '4 workouts per week' },
      { icon: 'pi pi-tag', label: 'Template (not assigned)' }
    ]);
  });

  it('singularizes one week', () => {
    expect(computePlanMetaChips('1', '').slice(0, 1)).toEqual([
      { icon: 'pi pi-calendar', label: '1 week' }
    ]);
  });

  it('shows placeholders for blank/invalid values', () => {
    const chips = computePlanMetaChips('', 'abc');
    expect(chips[0].label).toBe('— weeks');
    expect(chips[1].label).toBe('— per week');
  });
});
