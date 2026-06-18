import {
  adherenceTone,
  clampAdherencePct,
  completionLine,
  relativeDayLabel
} from './nutrition-adherence';

describe('nutrition-adherence', () => {
  it('buckets adherence percentages into tones', () => {
    expect(adherenceTone(100, 5)).toBe('good');
    expect(adherenceTone(80, 5)).toBe('good');
    expect(adherenceTone(60, 5)).toBe('ok');
    expect(adherenceTone(20, 5)).toBe('low');
    expect(adherenceTone(0, 0)).toBe('none');
  });

  it('clamps the API percentage into 0–100', () => {
    expect(clampAdherencePct(72.6)).toBe(73);
    expect(clampAdherencePct(140)).toBe(100);
    expect(clampAdherencePct(-3)).toBe(0);
    expect(clampAdherencePct('not-a-number')).toBe(0);
  });

  it('labels days relative to today', () => {
    const today = new Date(2026, 5, 11); // 11 Jun 2026
    expect(relativeDayLabel('2026-06-11', today)).toBe('Today');
    expect(relativeDayLabel('2026-06-10', today)).toBe('Yesterday');
    expect(relativeDayLabel('2026-06-08', today)).toBe('3 days ago');
    expect(relativeDayLabel('2026-05-01', today)).toContain('May');
    expect(relativeDayLabel('garbage', today)).toBe('');
  });

  it('summarizes completion counts', () => {
    expect(completionLine(3, 5)).toBe('3 of 5 items done');
    expect(completionLine(1, 1)).toBe('1 of 1 item done');
    expect(completionLine(0, 0)).toBe('');
  });
});
