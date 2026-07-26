// eval/fairness/__tests__/stability.test.ts
import { stability } from '../stability';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';
import type { Observation } from '../types';
import type { Fitzpatrick } from '../fst';
import type { ScoreVector } from '../../../src/features/read/read-types';

const gate = {
  face: true, lighting: true, focus: true, distance: true,
  glare: true, colour: true, evenness: true, pose: true,
  allPass: true, hint: '',
};
function scores(v: number): ScoreVector {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, v])) as ScoreVector;
}
function obs(fst: Fitzpatrick, subjectId: string, v: number): Observation {
  return { fst, subjectId, gate, scores: scores(v) };
}

test('a subject with identical repeat scores has zero instability', () => {
  const data = [obs('II', 's1', 0.5), obs('II', 's1', 0.5)];
  const r = stability(data, 1);
  expect(r.perFst.II).toBe(0);
});
test('more variation across a subject\'s repeats means higher instability', () => {
  const data = [obs('V', 's1', 0.2), obs('V', 's1', 0.8)];
  const r = stability(data, 1);
  // population std of [0.2, 0.8] is exactly 0.3; locks in the estimator (sample std would be ~0.424)
  expect(r.perFst.V).toBeCloseTo(0.3, 5);
});
test('a group with too few multi-capture subjects reports null', () => {
  const r = stability([obs('I', 's1', 0.5), obs('I', 's1', 0.5)], 2);
  expect(r.perFst.I).toBeNull();
});
