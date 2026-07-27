// eval/fairness/__tests__/report.test.ts
import { renderReportMarkdown, renderReportJson } from '../report';
import { fairnessReport } from '../metrics';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';
import type { Observation } from '../types';
import type { Fitzpatrick } from '../fst';
import type { ScoreVector } from '../../../src/features/read/read-types';

function scores(v: number): ScoreVector {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, v])) as ScoreVector;
}
function obs(fst: Fitzpatrick, subjectId: string): Observation {
  return { fst, subjectId, scores: scores(0.5),
    gate: {
      face: true, lighting: true, focus: true, distance: true,
      glare: true, colour: true, evenness: true, pose: true,
      allPass: true, hint: '',
    } };
}

const report = fairnessReport(
  ['I', 'II', 'III', 'IV', 'V', 'VI'].flatMap((f) =>
    [obs(f as Fitzpatrick, `${f}-a`), obs(f as Fitzpatrick, `${f}-a`)]),
  '2026-06-17T00:00:00Z',
  { minSamplesPerFst: 1, minSubjectsPerFst: 1, gateFloor: 0.9, gateMaxGap: 0.05,
    stabilityTolerance: 0.25, biasBound: 0.2, biasEffectFloor: 0.02 },
);

test('markdown shows the date, every FST group, and the overall verdict', () => {
  const md = renderReportMarkdown(report);
  expect(md).toContain('2026-06-17T00:00:00Z');
  expect(md).toContain('FST VI');
  expect(md).toMatch(/Overall: (PASS|FAIL|INSUFFICIENT SAMPLE)/);
});
test('the report carries no per-subject identifiers (aggregate only)', () => {
  const json = renderReportJson(report);
  expect(json).not.toContain('subjectId');
  expect(json).not.toContain('-a'); // the synthetic subject ids never appear
});
