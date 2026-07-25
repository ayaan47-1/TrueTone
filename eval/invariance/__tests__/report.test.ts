import { renderInvarianceMarkdown, renderInvarianceJson } from '../report';
import type { AxisResult } from '../types';

const RESULTS: AxisResult[] = [
  { name: 'illuminant', pass: false, worst: { dimension: 'pores', value: 0.31 }, detail: { pores: 0.31 } },
  { name: 'geometric', pass: true, worst: { dimension: 'redness', value: 0.01 }, detail: { redness: 0.01 } },
];

describe('invariance report', () => {
  it('renders a heading and one section per axis', () => {
    const md = renderInvarianceMarkdown(RESULTS, '2026-07-25T00:00:00Z');
    expect(md).toContain('# Invariance eval');
    expect(md).toContain('illuminant');
    expect(md).toContain('geometric');
  });

  it('marks failing axes FAIL and passing axes PASS', () => {
    const md = renderInvarianceMarkdown(RESULTS, '2026-07-25T00:00:00Z');
    expect(md).toMatch(/illuminant.*FAIL/s);
    expect(md).toMatch(/geometric.*PASS/s);
  });

  it('states plainly that this is not an accuracy claim', () => {
    // Compliance guard: any committed artifact that could be mistaken for validation data must
    // carry the disclaimer (CLAUDE.md §1).
    expect(renderInvarianceMarkdown(RESULTS, 'x')).toMatch(/not an accuracy claim/i);
  });

  it('emits parseable JSON carrying every axis verdict', () => {
    const parsed = JSON.parse(renderInvarianceJson(RESULTS, '2026-07-25T00:00:00Z'));
    expect(parsed.axes).toHaveLength(2);
    expect(parsed.pass).toBe(false);
  });

  it('reports overall pass only when every axis passes', () => {
    const allGood = RESULTS.map((r) => ({ ...r, pass: true }));
    expect(JSON.parse(renderInvarianceJson(allGood, 'x')).pass).toBe(true);
  });
});
