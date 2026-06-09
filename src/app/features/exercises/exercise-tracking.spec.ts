import { hasRequiredMetric, trackingProfile } from './exercise-tracking';

describe('exercise-tracking (mode → metric matrix, mirrors the server)', () => {
  it('strength requires reps; weight alone is not enough', () => {
    expect(hasRequiredMetric('Strength', { reps: 5, isCompleted: true })).toBe(true);
    expect(hasRequiredMetric('Strength', { weightKg: 100, isCompleted: true })).toBe(false);
  });

  it('cardio accepts duration or distance, not reps', () => {
    expect(hasRequiredMetric('Cardio', { durationSeconds: 600, isCompleted: true })).toBe(true);
    expect(hasRequiredMetric('Cardio', { distanceM: 2000, isCompleted: true })).toBe(true);
    expect(hasRequiredMetric('Cardio', { reps: 10, isCompleted: true })).toBe(false);
  });

  it('hiit accepts rounds or duration', () => {
    expect(hasRequiredMetric('Hiit', { rounds: 5, isCompleted: true })).toBe(true);
    expect(hasRequiredMetric('Hiit', { durationSeconds: 30, isCompleted: true })).toBe(true);
  });

  it('mobility allows a completion-only set', () => {
    expect(hasRequiredMetric('Mobility', { isCompleted: true })).toBe(true);
  });

  it('falls back to strength for an unknown / missing mode', () => {
    expect(trackingProfile(undefined).type).toBe('Strength');
    expect(trackingProfile('nonsense').type).toBe('Strength');
  });

  it('cardio profile shows duration/distance inputs, strength shows weight/reps', () => {
    expect(trackingProfile('Cardio').fields).toContain('duration');
    expect(trackingProfile('Cardio').fields).toContain('distance');
    expect(trackingProfile('Strength').fields).toContain('reps');
  });
});
