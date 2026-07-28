// Aggregate only — no images, no per-subject rows — so reports are safe to commit
// (matches eval/data/README.md policy).
import type { AxisResult } from './types';
import { SYNTHETIC_SCORING_PROVENANCE } from '../render/score';

export function renderInvarianceJson(results: AxisResult[], generatedAt: string): string {
  return JSON.stringify(
    {
      generatedAt,
      provenance: SYNTHETIC_SCORING_PROVENANCE,
      pass: results.every((r) => r.pass),
      axes: results,
    },
    null,
    2,
  );
}

export function renderInvarianceMarkdown(results: AxisResult[], generatedAt: string): string {
  const lines = [
    `# Invariance eval — ${generatedAt}`,
    '',
    '> Synthetic harness. Measures self-consistency of the pipeline under simulated lighting,',
    '> geometry and defect sweeps. It is **not an accuracy claim** and is not validation data on',
    '> file — no accuracy, efficacy or skin-tone-equity statement may cite it (CLAUDE.md §1).',
    '',
    `> region source: ${SYNTHETIC_SCORING_PROVENANCE.regionSource}`,
    `> contour fixture: ${SYNTHETIC_SCORING_PROVENANCE.contourFixture}`,
    '',
    '> **A pass is a claim about a condition, not about a dimension.** Every verdict below holds',
    '> only under the conditions that axis actually sweeps; a dimension can pass one sweep and fail',
    '> a wider one. A former bbox-scored, single-strength run hid a darkSpots regression. The',
    '> current harness scores MLKit-shaped contours and sweeps {0, 0.1, 0.25, 0.5, 0.75, 1.0}.',
    '> Cite a verdict WITH its scoring provenance and swept condition, or do not cite it.',
    '',
    `Overall: ${results.every((r) => r.pass) ? 'PASS' : 'FAIL'}`,
    '',
  ];
  for (const r of results) {
    lines.push(`## ${r.name} — ${r.pass ? 'PASS' : 'FAIL'}`);
    if (r.worst) lines.push(`- worst: ${r.worst.dimension} = ${r.worst.value.toFixed(4)}`);
    if (r.breaches.length > 0) {
      lines.push(`- over-epsilon (${r.breaches.length}):`);
      for (const b of r.breaches) {
        lines.push(`  - ${b.key}: ${b.value.toFixed(4)} (limit ${b.limit.toFixed(4)})`);
      }
    } else {
      lines.push('- over-epsilon: none');
    }
    for (const [k, v] of Object.entries(r.detail)) lines.push(`- ${k}: ${v.toFixed(4)}`);
    lines.push('');
  }
  return lines.join('\n');
}
