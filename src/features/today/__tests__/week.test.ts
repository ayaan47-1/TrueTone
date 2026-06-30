import { toDateKey, buildWeek, formatShortDate } from '../week';

describe('formatShortDate', () => {
  it('formats as "Mon D"', () => {
    expect(formatShortDate(new Date(2026, 5, 9))).toBe('Jun 9');
  });
  it('accepts an ISO string', () => {
    expect(formatShortDate('2026-01-03T12:00:00.000Z')).toMatch(/^Jan [23]$/);
  });
});

describe('toDateKey', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 5, 9))).toBe('2026-06-09');
  });
  it('normalizes an ISO timestamp to its local day', () => {
    expect(toDateKey('2026-06-24T08:30:00.000Z')).toMatch(/^2026-06-2[34]$/);
  });
});

describe('buildWeek', () => {
  const today = new Date(2026, 5, 24); // Wed Jun 24, 2026
  const week = buildWeek(today, ['2026-06-22', '2026-06-24']);

  it('returns 7 days labelled Sun→Sat in order', () => {
    expect(week).toHaveLength(7);
    expect(week.map((d) => d.label)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  it('flags exactly one day as today, matching the date', () => {
    const todays = week.filter((d) => d.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0].key).toBe('2026-06-24');
  });

  it('marks days that have a scan', () => {
    expect(week.find((d) => d.key === '2026-06-22')?.hasScan).toBe(true);
    expect(week.find((d) => d.key === '2026-06-24')?.hasScan).toBe(true);
    expect(week.find((d) => d.key === '2026-06-23')?.hasScan).toBe(false);
  });

  it('marks days after today as future', () => {
    expect(week.find((d) => d.key === '2026-06-25')?.isFuture).toBe(true);
    expect(week.find((d) => d.key === '2026-06-24')?.isFuture).toBe(false);
    expect(week.find((d) => d.key === '2026-06-23')?.isFuture).toBe(false);
  });

  it('exposes the day-of-month number', () => {
    expect(week.find((d) => d.key === '2026-06-24')?.dayOfMonth).toBe(24);
  });
});
