// eval/fairness/run-fixtures.ts
// Deterministic synthetic observations so the whole pipeline runs in CI with NO real faces.
// Two balanced captures per subject, one subject per FST group, all gates pass, constant scores.
import { FITZPATRICK } from './fst';
import { DIMENSIONS } from '../../src/content/cosmetic-vocab';
import type { Observation } from './types';
import type { ScoreVector } from '../../src/features/read/read-types';

function scores(v: number): ScoreVector {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, v])) as ScoreVector;
}

export function buildSyntheticObservations(): Observation[] {
  const gate = { face: true, lighting: true, focus: true, distance: true, allPass: true, hint: '' };
  return FITZPATRICK.flatMap((fst) => [
    { fst, subjectId: `${fst}-1`, gate, scores: scores(0.5) },
    { fst, subjectId: `${fst}-1`, gate, scores: scores(0.5) },
  ]);
}
