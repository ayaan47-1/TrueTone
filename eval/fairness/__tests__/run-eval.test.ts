// eval/fairness/__tests__/run-eval.test.ts
import { runEval, type Extractor } from '../run-eval';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';
import type { ManifestEntry } from '../manifest';
import type { ScoreVector } from '../../../src/features/read/read-types';

const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ScoreVector;
const entry = (id: string): ManifestEntry => ({
  imageRef: `${id}.jpg`, fst: 'III', subjectId: id, lighting: 'x',
  source: 'fixture', consentRef: 'c1', fstProvenance: 'annotated',
});
const extract: Extractor = async () => ({
  gate: { face: true, lighting: true, focus: true, distance: true, allPass: true, hint: '' },
  scores,
});

test('produces one observation per manifest entry, carrying FST + subjectId', async () => {
  const obs = await runEval([entry('a'), entry('b')], extract);
  expect(obs).toHaveLength(2);
  expect(obs[0].fst).toBe('III');
  expect(obs[0].subjectId).toBe('a');
  expect(obs[1].gate.allPass).toBe(true);
});
