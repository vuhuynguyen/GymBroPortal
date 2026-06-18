import { deviceTimeZone, relativeDayInZone } from './timezone';

describe('timezone helpers', () => {
  it('deviceTimeZone returns a non-empty zone id', () => {
    expect(deviceTimeZone().length).toBeGreaterThan(0);
  });

  it('relativeDayInZone is empty for missing or invalid input', () => {
    expect(relativeDayInZone(null)).toBe('');
    expect(relativeDayInZone('not-a-date')).toBe('');
  });

  it('labels the day in the data-owner’s zone, not the viewer’s', () => {
    // "now" is 2026-01-08 12:00 UTC → the 8th in both Bangkok (+07) and Toronto (−5).
    const now = new Date('2026-01-08T12:00:00Z');
    // The instant is 09:00 on the 8th in Bangkok, but 21:00 on the 7th in Toronto.
    const instant = '2026-01-08T02:00:00Z';
    expect(relativeDayInZone(instant, 'Asia/Bangkok', now)).toBe('Today');
    expect(relativeDayInZone(instant, 'America/Toronto', now)).toBe('Yesterday');
  });
});
