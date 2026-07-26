// eval/fairness/__tests__/gate-parity.test.ts
import { gateParity } from '../gate-parity';
import type { Observation } from '../types';
import type { Fitzpatrick } from '../fst';

const emptyScores = {} as Observation['scores'];
function obs(fst: Fitzpatrick, allPass: boolean): Observation {
  return { fst, subjectId: `${fst}-${Math.random()}`, scores: emptyScores,
    gate: {
      face: true, lighting: true, focus: true, distance: true,
      glare: true, colour: true, evenness: true, pose: true,
      allPass, hint: '',
    } };
}

test('computes per-FST pass rate and the best-worst gap above min samples', () => {
  const data = [
    ...Array.from({ length: 2 }, () => obs('I', true)),                    // I: 100%
    obs('VI', true), obs('VI', false), obs('VI', false), obs('VI', false), // VI: 25%
  ];
  const r = gateParity(data, 2);
  expect(r.perFst.I.rate).toBe(1);
  expect(r.perFst.VI.rate).toBe(0.25);
  expect(r.gap).toBeCloseTo(0.75, 5);
});
test('groups below min samples report a null rate (insufficient sample)', () => {
  const r = gateParity([obs('III', true)], 5);
  expect(r.perFst.III.rate).toBeNull();
  expect(r.perFst.III.total).toBe(1);
});
