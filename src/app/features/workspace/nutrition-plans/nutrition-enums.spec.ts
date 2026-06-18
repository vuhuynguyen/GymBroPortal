import {
  STANDARD_MEAL_NAMES,
  dayApplicabilityDisplay,
  dayApplicabilityToLabel,
  dayApplicabilityToValue,
  defaultMealName,
  loggedItemStatusToLabel,
  nutritionVisibilityToLabel,
  nutritionVisibilityToValue,
  scheduledTimeToInput,
  scheduledTimeToWire
} from './nutrition-enums';

describe('nutrition-enums', () => {
  it('defaults new meal names to the standard slots by position, then "Snack"', () => {
    expect(defaultMealName(1)).toBe('Breakfast');
    expect(defaultMealName(2)).toBe('Lunch');
    expect(defaultMealName(3)).toBe('Dinner');
    expect(defaultMealName(4)).toBe('Snack');
    expect(defaultMealName(5)).toBe('Snack');
    expect(STANDARD_MEAL_NAMES.length).toBe(4);
  });

  it('maps day applicability labels to the API wire ints', () => {
    expect(dayApplicabilityToValue('EveryDay')).toBe(1);
    expect(dayApplicabilityToValue('TrainingDay')).toBe(2);
    expect(dayApplicabilityToValue('RestDay')).toBe(3);
  });

  it('normalizes incoming camelCase strings and ints to day labels', () => {
    expect(dayApplicabilityToLabel('everyDay')).toBe('EveryDay');
    expect(dayApplicabilityToLabel('trainingDay')).toBe('TrainingDay');
    expect(dayApplicabilityToLabel(3)).toBe('RestDay');
    expect(dayApplicabilityToLabel('bogus')).toBeNull();
  });

  it('renders human day labels', () => {
    expect(dayApplicabilityDisplay('EveryDay')).toBe('Every day');
    expect(dayApplicabilityDisplay('TrainingDay')).toBe('Training days');
  });

  it('maps visibility labels to ints and back (case-insensitive)', () => {
    expect(nutritionVisibilityToValue('Full')).toBe(1);
    expect(nutritionVisibilityToValue('Blind')).toBe(3);
    expect(nutritionVisibilityToLabel('guided')).toBe('Guided');
    expect(nutritionVisibilityToLabel(1)).toBe('Full');
    expect(nutritionVisibilityToLabel('nope')).toBeNull();
  });

  it('normalizes logged-item statuses with Planned as the fallback', () => {
    expect(loggedItemStatusToLabel('completed')).toBe('Completed');
    expect(loggedItemStatusToLabel('substituted')).toBe('Substituted');
    expect(loggedItemStatusToLabel('missed')).toBe('Missed');
    expect(loggedItemStatusToLabel(undefined)).toBe('Planned');
  });

  it('converts TimeOnly wire values to HH:mm input values', () => {
    expect(scheduledTimeToInput('08:30:00')).toBe('08:30');
    expect(scheduledTimeToInput('8:05')).toBe('08:05');
    expect(scheduledTimeToInput(null)).toBe('');
    expect(scheduledTimeToInput('25:00')).toBe('');
  });

  it('converts HH:mm input values to HH:mm:ss wire values', () => {
    expect(scheduledTimeToWire('08:30')).toBe('08:30:00');
    expect(scheduledTimeToWire('')).toBeNull();
  });
});
