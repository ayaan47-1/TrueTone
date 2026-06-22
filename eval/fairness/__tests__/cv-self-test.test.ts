import { buildSelfTestManifest, cvSelfTestExtractor } from '../cv-extractor';
import { runEval } from '../run-eval';
import { fairnessReport } from '../metrics';

test('CV scores are tone-invariant: fairness report passes on the self-test set', async () => {
  const manifest = buildSelfTestManifest(30); // 30 subjects/FST, 2 captures each
  const observations = await runEval(manifest, cvSelfTestExtractor);
  const report = fairnessReport(observations, '2026-06-22T00:00:00.000Z');

  expect(report.bias.pass).toBe(true);
  expect(report.pass).toBe(true);
});
