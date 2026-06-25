import { computeSkinFreshnessTrend, FRESHNESS_POLARITY } from '../skin-age-trend';
import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ScoreVector } from '../../read/read-types';

function vec(fill: number): ScoreVector {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, fill])) as ScoreVector;
}

describe('computeSkinFreshnessTrend', () => {
  it('every dimension has a defined polarity', () => {
    for (const d of DIMENSIONS) expect(FRESHNESS_POLARITY[d]).toBeDefined();
  });

  it('returns steady with no real trend when given fewer than 2 scans', () => {
    expect(computeSkinFreshnessTrend([])).toEqual({ direction: 'steady', delta: 0, sampleCount: 0 });
    const one = computeSkinFreshnessTrend([{ capturedAt: '2026-06-01', scores: vec(0.5) }]);
    expect(one).toEqual({ direction: 'steady', delta: 0, sampleCount: 1 });
  });

  it('reads as fresher when appearance scores drop and hydration rises', () => {
    // baseline: low hydration, high blemish-appearance; latest: improved on both axes.
    const baseline: ScoreVector = { ...vec(0.6), hydration: 0.3 };
    const latest: ScoreVector = { ...vec(0.2), hydration: 0.9 };
    const t = computeSkinFreshnessTrend([
      { capturedAt: '2026-06-10', scores: latest },
      { capturedAt: '2026-06-01', scores: baseline },
    ]);
    expect(t.direction).toBe('fresher');
    expect(t.delta).toBeGreaterThan(0);
    expect(t.sampleCount).toBe(2);
  });

  it('reads as more-tired when appearance worsens', () => {
    const baseline: ScoreVector = { ...vec(0.2), hydration: 0.9 };
    const latest: ScoreVector = { ...vec(0.7), hydration: 0.3 };
    const t = computeSkinFreshnessTrend([
      { capturedAt: '2026-06-10', scores: latest },
      { capturedAt: '2026-06-01', scores: baseline },
    ]);
    expect(t.direction).toBe('more-tired');
    expect(t.delta).toBeLessThan(0);
  });

  it('reads as steady for negligible change', () => {
    const t = computeSkinFreshnessTrend([
      { capturedAt: '2026-06-10', scores: vec(0.5) },
      { capturedAt: '2026-06-01', scores: vec(0.5) },
    ]);
    expect(t.direction).toBe('steady');
  });
});
