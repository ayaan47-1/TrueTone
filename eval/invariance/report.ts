// Aggregate only — no images, no per-subject rows — so reports are safe to commit
// (matches eval/data/README.md policy).
import type { AxisResult } from './types';

export function renderInvarianceJson(results: AxisResult[], generatedAt: string): string {
  return JSON.stringify(
    { generatedAt, pass: results.every((r) => r.pass), axes: results },
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
