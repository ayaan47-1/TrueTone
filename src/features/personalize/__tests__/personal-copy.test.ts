import { personalCopy } from '../personal-copy';
import { MAX_MESSAGES } from '../types';
import type { PersonalDeviation } from '../types';

const dev = (
  entries: Partial<PersonalDeviation>,
): PersonalDeviation => entries as PersonalDeviation;

describe('personalCopy', () => {
  test('within-only deviations produce no messages', () => {
    expect(
      personalCopy(dev({ hydration: { status: 'within', z: 0, favorable: null } })),
    ).toEqual([]);
  });

  test('an unfavorable deviation produces a relative, appearance-only sentence', () => {
    const msgs = personalCopy(
      dev({ redness: { status: 'above', z: 2, favorable: false } }),
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/redness/i);
    expect(msgs[0]).toMatch(/your usual/i);
  });

  test('unfavorable messages come before favorable ones', () => {
    const msgs = personalCopy(
      dev({
        hydration: { status: 'above', z: 2, favorable: true },   // favorable
        fineLines: { status: 'above', z: 2, favorable: false },  // unfavorable
      }),
    );
    expect(msgs[0]).toMatch(/fine lines/i);
    expect(msgs[1]).toMatch(/hydration/i);
  });

  test('neutral (oiliness) comes after favorable and carries no judgment suffix', () => {
    const msgs = personalCopy(
      dev({
        hydration: { status: 'above', z: 2, favorable: true },
        oiliness: { status: 'above', z: 2, favorable: null },
      }),
    );
    expect(msgs[1]).toMatch(/oiliness/i);
    expect(msgs[1]).not.toMatch(/settled|focus/i);
  });

  test('caps output at MAX_MESSAGES', () => {
    const msgs = personalCopy(
      dev({
        redness: { status: 'above', z: 2, favorable: false },
        texture: { status: 'above', z: 2, favorable: false },
        darkCircles: { status: 'above', z: 2, favorable: false },
        pores: { status: 'above', z: 2, favorable: false },
      }),
    );
    expect(msgs).toHaveLength(MAX_MESSAGES);
  });

  test('empty deviation produces no messages', () => {
    expect(personalCopy({})).toEqual([]);
  });
});
