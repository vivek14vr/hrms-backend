import { calendarDateInTimeZone, monthPeriod, startOfDayInTimeZone } from '../src/attendance/attendance-metrics';

describe('attendance calendar metrics', () => {
  it('uses the workspace timezone for calendar dates and current-month cutoffs', () => {
    const instant = new Date('2026-08-31T23:30:00.000Z');

    expect(calendarDateInTimeZone(instant, 'Asia/Kolkata')).toBe('2026-09-01');
    expect(startOfDayInTimeZone(instant, 'Asia/Kolkata')).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    expect(monthPeriod(9, 2026, instant, 'Asia/Kolkata').endExclusive).toEqual(new Date('2026-09-02T00:00:00.000Z'));
    expect(monthPeriod(9, 2026, instant, 'UTC').endExclusive).toEqual(new Date('2026-09-01T00:00:00.000Z'));
  });
});
