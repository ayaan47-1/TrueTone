import { renderInvarianceMarkdown, renderInvarianceJson } from '../report';
import type { AxisResult } from '../types';

const RESULTS: AxisResult[] = [
  {
    name: 'illuminant',
    pass: false,
    worst: { dimension: 'pores', value: 0.31 },
    detail: { pores: 0.31 },
    breaches: [{ key: 'pores', value: 0.31, limit: 0.12 }],
  },
  {
    name: 'geometric',
    pass: true,
    worst: { dimension: 'redness', value: 0.01 },
    detail: { redness: 0.01 },
    breaches: [],
  },
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

  it('lists every dimension over its epsilon, not just the worst', () => {
    const results: AxisResult[] = [{
      name: 'illuminant',
      pass: false,
      worst: { dimension: 'oiliness', value: 0.3632 },
      detail: { darkSpots: 0.1115, redness: 0.0875, oiliness: 0.3632 },
      breaches: [
        { key: 'darkSpots', value: 0.1115, limit: 0.08 },
        { key: 'redness', value: 0.0875, limit: 0.08 },
        { key: 'oiliness', value: 0.3632, limit: 0.12 },
      ],
    }];
    const md = renderInvarianceMarkdown(results, 'x');
    expect(md).toContain('darkSpots');
    expect(md).toContain('redness');
    expect(md).toContain('oiliness');
    // both non-worst breaches must appear, not just the single worst dimension
    const breachLines = md.split('\n').filter((l) => l.includes('(limit'));
    expect(breachLines.length).toBe(3);
  });

  it('still states plainly that this is not an accuracy claim after the breach-list change', () => {
    // guards against accidentally dropping the disclaimer while restructuring the render function
    expect(renderInvarianceMarkdown(RESULTS, 'x')).toMatch(/not an accuracy claim/i);
  });

  it('the JSON output carries the breaches array for every axis', () => {
    const parsed = JSON.parse(renderInvarianceJson(RESULTS, 'x'));
    for (const axis of parsed.axes) expect(Array.isArray(axis.breaches)).toBe(true);
  });
});
