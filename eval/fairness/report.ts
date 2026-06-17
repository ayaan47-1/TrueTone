// eval/fairness/report.ts
import type { FairnessReport } from './metrics';
import { FITZPATRICK } from './fst';

// FairnessReport is aggregate by construction (no per-subject rows), so JSON is safe to commit.
export function renderReportJson(r: FairnessReport): string {
  return JSON.stringify(r, null, 2);
}

function verdict(p: boolean | null): string {
  return p === null ? 'INSUFFICIENT SAMPLE' : p ? 'PASS' : 'FAIL';
}

export function renderReportMarkdown(r: FairnessReport): string {
  const lines: string[] = [
    `# Fairness eval — ${r.generatedAt}`,
    '',
    `Observations: ${r.totalObservations} · Overall: ${verdict(r.pass)}`,
    '',
    '## Quality-gate parity',
  ];
  for (const f of FITZPATRICK) {
    const g = r.gate.perFst[f];
    lines.push(`- FST ${f}: ${g.rate === null ? 'insufficient sample' : `${(g.rate * 100).toFixed(1)}% (${g.pass}/${g.total})`}`);
  }
  lines.push(`- gap: ${r.gate.gap === null ? 'n/a' : `${(r.gate.gap * 100).toFixed(1)} pp`} · axis: ${verdict(r.gate.pass)}`);
  lines.push('', '## Score stability (lower = better)');
  for (const f of FITZPATRICK) {
    const v = r.stability.perFst[f];
    lines.push(`- FST ${f}: ${v === null ? 'insufficient sample' : v.toFixed(4)}`);
  }
  lines.push(`- axis: ${verdict(r.stability.pass)}`);
  lines.push('', '## Systematic bias (|corr(FST, score)|)');
  lines.push(`- flagged dimensions: ${r.bias.flagged.length ? r.bias.flagged.join(', ') : 'none'} · axis: ${r.bias.pass ? 'PASS' : 'FAIL'}`);
  return lines.join('\n');
}
