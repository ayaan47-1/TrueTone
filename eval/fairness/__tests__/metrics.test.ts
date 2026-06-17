// eval/fairness/__tests__/metrics.test.ts
import { fairnessReport } from '../metrics';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';
import type { Observation } from '../types';
import type { Fitzpatrick } from '../fst';
import type { ScoreVector } from '../../../src/features/read/read-types';

function scores(v: number): ScoreVector {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, v])) as ScoreVector;
}
function obs(fst: Fitzpatrick, subjectId: string, allPass: boolean, v: number): Observation {
  return { fst, subjectId, scores: scores(v),
    gate: { face: true, lighting: true, focus: true, distance: true, allPass, hint: '' } };
}
// loose thresholds so a tiny synthetic set can exercise pass/fail deterministically
const t = { minSamplesPerFst: 1, minSubjectsPerFst: 1, gateFloor: 0.9, gateMaxGap: 0.05,
  stabilityTolerance: 0.25, biasBound: 0.2 } as const;

test('a balanced set passes every axis', () => {
  const data = ['I', 'II', 'III', 'IV', 'V', 'VI'].flatMap((f) =>
    [obs(f as Fitzpatrick, `${f}-a`, true, 0.5), obs(f as Fitzpatrick, `${f}-a`, true, 0.5)]);
  const r = fairnessReport(data, '2026-06-17T00:00:00Z', t);
  expect(r.gate.pass).toBe(true);
  expect(r.bias.pass).toBe(true);
  expect(r.pass).toBe(true);
});
test('a gate disparity fails the gate axis and overall', () => {
  const data = [
    obs('I', 'I-a', true, 0.5), obs('I', 'I-a', true, 0.5),
    obs('VI', 'VI-a', false, 0.5), obs('VI', 'VI-a', false, 0.5), // VI never passes the gate
  ];
  const r = fairnessReport(data, '2026-06-17T00:00:00Z', t);
  expect(r.gate.pass).toBe(false);
  expect(r.pass).toBe(false);
});
test('overall is null (insufficient) when a group lacks samples', () => {
  const r = fairnessReport([obs('I', 'I-a', true, 0.5)], '2026-06-17T00:00:00Z',
    { ...t, minSamplesPerFst: 50 });
  expect(r.gate.pass).toBeNull();
  expect(r.pass).toBeNull();
});
