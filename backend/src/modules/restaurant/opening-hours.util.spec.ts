import { isOpenNow, toVnNow, type OpeningHourRow } from './opening-hours.util';

function time(hh: number, mm = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, hh, mm));
}

describe('toVnNow', () => {
  it('adds the fixed +7 offset without crossing midnight', () => {
    // 2026-08-01 10:00 UTC (Saturday) -> 17:00 VN, same day
    const result = toVnNow(new Date(Date.UTC(2026, 7, 1, 10, 0)));
    expect(result).toEqual({ dayOfWeek: 6, minutesSinceMidnight: 17 * 60 });
  });

  it('rolls over to the next VN day when +7h crosses midnight UTC', () => {
    // 2026-08-01 19:00 UTC (Saturday) -> 02:00 VN Sunday
    const result = toVnNow(new Date(Date.UTC(2026, 7, 1, 19, 0)));
    expect(result).toEqual({ dayOfWeek: 0, minutesSinceMidnight: 2 * 60 });
  });
});

describe('isOpenNow', () => {
  it('is open during same-day hours (e.g. 08:00-22:00)', () => {
    const hours: OpeningHourRow[] = [
      { dayOfWeek: 3, openTime: time(8), closeTime: time(22), isClosed: false },
    ];
    expect(
      isOpenNow(hours, { dayOfWeek: 3, minutesSinceMidnight: 12 * 60 }),
    ).toBe(true);
    expect(
      isOpenNow(hours, { dayOfWeek: 3, minutesSinceMidnight: 7 * 60 + 59 }),
    ).toBe(false);
    expect(
      isOpenNow(hours, { dayOfWeek: 3, minutesSinceMidnight: 22 * 60 }),
    ).toBe(false);
  });

  it('is closed on a day marked isClosed even if a time range is present', () => {
    const hours: OpeningHourRow[] = [
      { dayOfWeek: 1, openTime: time(8), closeTime: time(22), isClosed: true },
    ];
    expect(
      isOpenNow(hours, { dayOfWeek: 1, minutesSinceMidnight: 12 * 60 }),
    ).toBe(false);
  });

  it('handles overnight hours (18:00 -> 02:00): open late at night on the start day', () => {
    const hours: OpeningHourRow[] = [
      { dayOfWeek: 5, openTime: time(18), closeTime: time(2), isClosed: false },
    ];
    // Friday 23:00 — still within Friday's overnight window.
    expect(
      isOpenNow(hours, { dayOfWeek: 5, minutesSinceMidnight: 23 * 60 }),
    ).toBe(true);
  });

  it('handles overnight hours (18:00 -> 02:00): still open at 01:00 the following day', () => {
    const hours: OpeningHourRow[] = [
      { dayOfWeek: 5, openTime: time(18), closeTime: time(2), isClosed: false },
    ];
    // Saturday 01:00 — spillover from Friday's overnight row.
    expect(
      isOpenNow(hours, { dayOfWeek: 6, minutesSinceMidnight: 1 * 60 }),
    ).toBe(true);
  });

  it('handles overnight hours: closed once past the 02:00 cutoff the next day', () => {
    const hours: OpeningHourRow[] = [
      { dayOfWeek: 5, openTime: time(18), closeTime: time(2), isClosed: false },
    ];
    expect(
      isOpenNow(hours, { dayOfWeek: 6, minutesSinceMidnight: 3 * 60 }),
    ).toBe(false);
  });

  it('is closed with no matching row for the day', () => {
    const hours: OpeningHourRow[] = [
      { dayOfWeek: 1, openTime: time(8), closeTime: time(22), isClosed: false },
    ];
    expect(
      isOpenNow(hours, { dayOfWeek: 2, minutesSinceMidnight: 12 * 60 }),
    ).toBe(false);
  });
});
