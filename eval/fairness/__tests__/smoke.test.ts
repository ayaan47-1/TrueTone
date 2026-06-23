// eval/fairness/__tests__/smoke.test.ts
import { buildSyntheticObservations } from '../run-fixtures';
import { fairnessReport } from '../metrics';
import { renderReportMarkdown } from '../report';

test('end-to-end on synthetic data produces a complete report', () => {
  const obs = buildSyntheticObservations();
  const report = fairnessReport(obs, '2026-06-17T00:00:00Z',
    { minSamplesPerFst: 1, minSubjectsPerFst: 1, gateFloor: 0.9, gateMaxGap: 0.05,
      stabilityTolerance: 0.25, biasBound: 0.2, biasEffectFloor: 0.02 });
  expect(report.totalObservations).toBeGreaterThan(0);
  // synthetic data is balanced across all six FST groups with identical scores -> deterministic PASS
  expect(report.pass).toBe(true);
  expect(renderReportMarkdown(report)).toContain('Overall:');
});
