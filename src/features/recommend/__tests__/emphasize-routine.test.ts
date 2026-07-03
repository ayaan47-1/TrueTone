import { emphasizeRoutine } from '../emphasize-routine';
import type { Routine, RoutineStep } from '../routine-types';
import type { PersonalDeviation } from '../../personalize/types';

const step = (category: string, dimensions: RoutineStep['dimensions']): RoutineStep =>
  ({ category, habit: 'h', rationale: 'r', dimensions });

const routine: Routine = {
  version: 'skincare-1',
  am: [step('cleanser', ['oiliness']), step('moisturizer', ['hydration']), step('spf', [])],
  pm: [step('pm-cleanser', ['redness'])],
  notes: ['note'],
};

const unfavorableHydration: PersonalDeviation = {
  hydration: { status: 'below', z: -2, favorable: false },
};

describe('emphasizeRoutine', () => {
  test('moves steps driven by unfavorable dimensions to the front, flagged', () => {
    const result = emphasizeRoutine(routine, unfavorableHydration);
    expect(result.am[0].category).toBe('moisturizer');
    expect(result.am[0].emphasized).toBe(true);
    expect(result.am.map((s) => s.category)).toEqual(['moisturizer', 'cleanser', 'spf']);
  });

  test('favorable and within deviations do not emphasize', () => {
    const dev: PersonalDeviation = {
      oiliness: { status: 'above', z: 2, favorable: null },   // neutral
      redness: { status: 'below', z: -2, favorable: true },   // favorable
    };
    const result = emphasizeRoutine(routine, dev);
    expect(result.am.map((s) => s.category)).toEqual(['cleanser', 'moisturizer', 'spf']);
    expect(result.am.every((s) => s.emphasized !== true)).toBe(true);
    expect(result.pm[0].emphasized).toBeUndefined();
  });

  test('never adds or removes steps', () => {
    const result = emphasizeRoutine(routine, unfavorableHydration);
    expect(result.am).toHaveLength(3);
    expect(result.pm).toHaveLength(1);
    expect(result.notes).toEqual(['note']);
    expect(result.version).toBe('skincare-1');
  });

  test('returns a new object and does not mutate the input', () => {
    const before = JSON.parse(JSON.stringify(routine));
    const result = emphasizeRoutine(routine, unfavorableHydration);
    expect(result).not.toBe(routine);
    expect(routine).toEqual(before); // input untouched (immutability rule)
  });

  test('empty deviation is a stable no-op on ordering', () => {
    const result = emphasizeRoutine(routine, {});
    expect(result.am.map((s) => s.category)).toEqual(['cleanser', 'moisturizer', 'spf']);
  });
});
