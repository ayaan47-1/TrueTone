// eval/fairness/__tests__/bias.test.ts
import { bias } from '../bias';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';
import type { Observation } from '../types';
import type { Fitzpatrick } from '../fst';
import type { ScoreVector } from '../../../src/features/read/read-types';

const gate = { face: true, lighting: true, focus: true, distance: true, allPass: true, hint: '' };
function ob(fst: Fitzpatrick, darkSpots: number): Observation {
  const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ScoreVector;
  scores.darkSpots = darkSpots;
  return { fst, subjectId: `${fst}`, gate, scores };
}

test('flags a dimension whose score tracks Fitzpatrick index (systematic bias)', () => {
  // darkSpots rises monotonically with FST -> strong positive correlation
  const data: Observation[] = [
    ob('I', 0.1), ob('II', 0.2), ob('III', 0.3), ob('IV', 0.6), ob('V', 0.8), ob('VI', 0.95),
  ];
  const r = bias(data, 0.2);
  expect(r.flagged).toContain('darkSpots');
  expect(Math.abs(r.perDimension.darkSpots)).toBeGreaterThan(0.2);
});
test('does not flag a dimension that varies but does not track Fitzpatrick index', () => {
  // hydration genuinely varies (not a constant -> not just the div-by-zero guard), but its values
  // are symmetric about the FST midpoint, so corr(FST index, hydration) is ~0 -> must not be flagged.
  const hydrationByFst: Record<Fitzpatrick, number> = {
    I: 0.4, II: 0.5, III: 0.6, IV: 0.6, V: 0.5, VI: 0.4,
  };
  const data: Observation[] = (['I', 'II', 'III', 'IV', 'V', 'VI'] as Fitzpatrick[]).map((f) => {
    const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ScoreVector;
    scores.hydration = hydrationByFst[f];
    return { fst: f, subjectId: f, gate, scores };
  });
  const r = bias(data, 0.2);
  expect(r.flagged).not.toContain('hydration');
  expect(Math.abs(r.perDimension.hydration)).toBeLessThan(0.2);
});
