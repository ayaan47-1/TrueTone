// Report GENERATOR, not a unit test — it is how `npm run eval:invariance` produces the committed
// artifact. Lives under __tests__ because Jest is the only TypeScript runner available (ts-node is
// not a dependency and Global Constraints forbid adding one).
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { runAllAxes } from '../axes';
import { renderInvarianceMarkdown, renderInvarianceJson } from '../report';

// Fixed stamp source: the axes are deterministic, so only the timestamp varies between runs.
const stamp = new Date().toISOString();
const dir = join(__dirname, '..', '..', 'reports');

describe('invariance report writer', () => {
  const results = runAllAxes();

  it('writes the aggregate report to eval/reports', () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'invariance.md'), renderInvarianceMarkdown(results, stamp));
    writeFileSync(join(dir, 'invariance.json'), renderInvarianceJson(results, stamp));
    expect(existsSync(join(dir, 'invariance.md'))).toBe(true);
    expect(existsSync(join(dir, 'invariance.json'))).toBe(true);
  });

  it('reports a verdict for every axis', () => {
    expect(results).toHaveLength(4);
    for (const r of results) expect(typeof r.pass).toBe('boolean');
  });

  it('produces a report naming every axis and carrying the not-an-accuracy-claim disclaimer', () => {
    const md = renderInvarianceMarkdown(results, stamp);
    for (const r of results) expect(md).toContain(r.name);
    expect(md).toMatch(/not an accuracy claim/i);
    // eslint-disable-next-line no-console
    console.log(md); // surfaces the verdicts in CI output
  });
});
