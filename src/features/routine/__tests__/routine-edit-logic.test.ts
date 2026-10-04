import { emptyDay, replaceProduct, routineForDay } from '../routine-logic';
import type { RoutineLog } from '../routine-types';

describe('replaceProduct (edit a step)', () => {
  it('swaps the product in place, keeping step order, without mutating', () => {
    const day = { date: '2026-10-04', am: ['a', 'b', 'c'], pm: [] };
    const next = replaceProduct(day, 'am', 'b', 'x');
    expect(next.am).toEqual(['a', 'x', 'c']);
    expect(day.am).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op when the old id is not in the slot', () => {
    const day = { date: '2026-10-04', am: ['a'], pm: [] };
    expect(replaceProduct(day, 'am', 'zzz', 'x')).toBe(day);
  });

  it('drops the old step when the new product is already elsewhere in the slot (no duplicates)', () => {
    const day = { date: '2026-10-04', am: ['a', 'b'], pm: [] };
    expect(replaceProduct(day, 'am', 'a', 'b').am).toEqual(['b']);
  });
});

describe('routineForDay (a routine repeats day to day)', () => {
  it("returns today's saved entry when there is one", () => {
    const log: RoutineLog = { '2026-10-04': { date: '2026-10-04', am: ['t'], pm: [] } };
    expect(routineForDay(log, '2026-10-04')).toEqual(log['2026-10-04']);
  });

  it('carries forward the most recent earlier day, re-dated to today', () => {
    const log: RoutineLog = {
      '2026-09-30': { date: '2026-09-30', am: ['old'], pm: [] },
      '2026-10-02': { date: '2026-10-02', am: ['a'], pm: ['b'] },
    };
    expect(routineForDay(log, '2026-10-04')).toEqual({ date: '2026-10-04', am: ['a'], pm: ['b'] });
  });

  it('ignores future-dated days and returns an empty day with no history', () => {
    const log: RoutineLog = { '2026-10-09': { date: '2026-10-09', am: ['f'], pm: [] } };
    expect(routineForDay(log, '2026-10-04')).toEqual(emptyDay('2026-10-04'));
    expect(routineForDay({}, '2026-10-04')).toEqual(emptyDay('2026-10-04'));
  });

  it('a saved-but-empty today wins over history (the user cleared it on purpose)', () => {
    const log: RoutineLog = {
      '2026-10-03': { date: '2026-10-03', am: ['a'], pm: [] },
      '2026-10-04': { date: '2026-10-04', am: [], pm: [] },
    };
    expect(routineForDay(log, '2026-10-04')).toEqual(emptyDay('2026-10-04'));
  });
});
