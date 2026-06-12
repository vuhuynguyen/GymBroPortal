import {
  EMPTY_MACROS,
  formatMacroLine,
  parseQuantity,
  scaleMacros,
  sumMacros,
  type MacroSet
} from './nutrition-macros';

const chicken: MacroSet = { energyKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 };

describe('nutrition-macros', () => {
  describe('scaleMacros', () => {
    it('multiplies each metric by quantity', () => {
      const m = scaleMacros(chicken, 2);
      expect(m.energyKcal).toBe(330);
      expect(m.proteinG).toBe(62);
      expect(m.fatG).toBe(7.2);
    });

    it('supports fractional quantities with rounding to 1 decimal', () => {
      const m = scaleMacros(chicken, 1.5);
      expect(m.energyKcal).toBe(247.5);
      expect(m.proteinG).toBe(46.5);
      expect(m.fatG).toBe(5.4);
    });

    it('keeps null metrics null instead of fabricating zeros', () => {
      const m = scaleMacros({ energyKcal: 100, proteinG: null, carbsG: null, fatG: null, fiberG: null }, 3);
      expect(m.energyKcal).toBe(300);
      expect(m.proteinG).toBeNull();
      expect(m.carbsG).toBeNull();
    });

    it('returns all-null for missing food or invalid quantity', () => {
      expect(scaleMacros(null, 2)).toEqual(EMPTY_MACROS);
      expect(scaleMacros(chicken, Number.NaN)).toEqual(EMPTY_MACROS);
      expect(scaleMacros(chicken, -1)).toEqual(EMPTY_MACROS);
    });
  });

  describe('sumMacros', () => {
    it('sums across items and treats nulls as absent', () => {
      const total = sumMacros([
        scaleMacros(chicken, 1),
        { energyKcal: 200, proteinG: null, carbsG: 40, fatG: null, fiberG: 5 }
      ]);
      expect(total.energyKcal).toBe(365);
      expect(total.proteinG).toBe(31);
      expect(total.carbsG).toBe(40);
      expect(total.fiberG).toBe(5);
    });

    it('stays null when no input carries a metric', () => {
      expect(sumMacros([])).toEqual(EMPTY_MACROS);
      expect(sumMacros([EMPTY_MACROS, EMPTY_MACROS]).energyKcal).toBeNull();
    });
  });

  describe('formatMacroLine', () => {
    it('renders only the present metrics', () => {
      expect(formatMacroLine({ energyKcal: 650, proteinG: 42, carbsG: 70, fatG: 18, fiberG: null }))
        .toBe('650 kcal · P 42g · C 70g · F 18g');
      expect(formatMacroLine({ energyKcal: 100, proteinG: null, carbsG: null, fatG: null, fiberG: null }))
        .toBe('100 kcal');
      expect(formatMacroLine(EMPTY_MACROS)).toBe('');
    });

    it('formats fractional values with one decimal', () => {
      expect(formatMacroLine({ ...EMPTY_MACROS, fatG: 7.2 })).toBe('F 7.2g');
    });
  });

  describe('parseQuantity', () => {
    it('accepts positive decimals and rounds to 2 places', () => {
      expect(parseQuantity('1.5')).toBe(1.5);
      expect(parseQuantity(2)).toBe(2);
      expect(parseQuantity('0.333')).toBe(0.33);
    });

    it('rejects blank, zero, negative and non-numeric input', () => {
      expect(parseQuantity('')).toBeNull();
      expect(parseQuantity('0')).toBeNull();
      expect(parseQuantity('-2')).toBeNull();
      expect(parseQuantity('abc')).toBeNull();
    });
  });
});
