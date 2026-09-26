import {
  emptyDay,
  addProduct,
  removeProduct,
  dayHasEntries,
  computeStreak,
  summarize,
} from '../routine-logic';
import type { RoutineLog } from '../routine-types';

describe('day mutations (immutable)', () => {
  it('emptyDay makes a blank day for the key', () => {
    expect(emptyDay('2026-09-26')).toEqual({ date: '2026-09-26', am: [], pm: [] });
  });

  it('addProduct appends to the slot and does not mutate the input', () => {
    const day = emptyDay('2026-09-26');
    const next = addProduct(day, 'am', 'lum-tint-01');
    expect(next.am).toEqual(['lum-tint-01']);
    expect(day.am).toEqual([]); // original unchanged
  });

  it('addProduct is idempotent per slot (no duplicates)', () => {
    let day = emptyDay('2026-09-26');
    day = addProduct(day, 'am', 'lum-tint-01');
    day = addProduct(day, 'am', 'lum-tint-01');
    expect(day.am).toEqual(['lum-tint-01']);
  });

  it('the same product can be logged in both AM and PM', () => {
    let day = emptyDay('2026-09-26');
    day = addProduct(day, 'am', 'lum-tint-01');
    day = addProduct(day, 'pm', 'lum-tint-01');
    expect(day.am).toEqual(['lum-tint-01']);
    expect(day.pm).toEqual(['lum-tint-01']);
  });

  it('removeProduct drops it from the slot immutably', () => {
    const day = addProduct(emptyDay('2026-09-26'), 'pm', 'sol-full-07');
    const next = removeProduct(day, 'pm', 'sol-full-07');
    expect(next.pm).toEqual([]);
    expect(day.pm).toEqual(['sol-full-07']);
  });

  it('dayHasEntries reflects any slot having a product', () => {
    expect(dayHasEntries(emptyDay('2026-09-26'))).toBe(false);
    expect(dayHasEntries(addProduct(emptyDay('2026-09-26'), 'am', 'x'))).toBe(true);
  });
});

describe('computeStreak', () => {
  const today = new Date(2026, 8, 26); // 2026-09-26 local
  const logWith = (dates: string[]): RoutineLog => {
    const log: RoutineLog = {};
    for (const d of dates) log[d] = { date: d, am: ['x'], pm: [] };
    return log;
  };

  it('is 0 when today has no entries', () => {
    expect(computeStreak(logWith(['2026-09-25']), today)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreak(logWith(['2026-09-24', '2026-09-25', '2026-09-26']), today)).toBe(3);
  });

  it('stops at the first gap', () => {
    expect(computeStreak(logWith(['2026-09-23', '2026-09-26']), today)).toBe(1);
  });

  it('ignores empty-day records', () => {
    const log: RoutineLog = { '2026-09-26': { date: '2026-09-26', am: [], pm: [] } };
    expect(computeStreak(log, today)).toBe(0);
  });
});

describe('summarize', () => {
  const today = new Date(2026, 8, 26);
  it('reports AM/PM/today counts and the streak', () => {
    const log: RoutineLog = {
      '2026-09-25': { date: '2026-09-25', am: ['a'], pm: [] },
      '2026-09-26': { date: '2026-09-26', am: ['a', 'b'], pm: ['c'] },
    };
    expect(summarize(log, today)).toEqual({ amCount: 2, pmCount: 1, todayCount: 3, streak: 2 });
  });

  it('is all-zero for an empty log', () => {
    expect(summarize({}, today)).toEqual({ amCount: 0, pmCount: 0, todayCount: 0, streak: 0 });
  });
});
