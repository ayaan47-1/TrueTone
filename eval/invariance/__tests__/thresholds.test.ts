import { INVARIANCE_THRESHOLDS as T } from '../thresholds';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';

describe('invariance thresholds', () => {
  it('defines an epsilon for every dimension', () => {
    for (const d of DIMENSIONS) expect(typeof T.epsilon[d]).toBe('number');
  });

  it('keeps every epsilon inside a meaningful 0..1 score range', () => {
    for (const d of DIMENSIONS) {
      expect(T.epsilon[d]).toBeGreaterThan(0);
      expect(T.epsilon[d]).toBeLessThan(0.5);
    }
  });

  it('sets a Spearman floor strong enough to mean "responds monotonically"', () => {
    expect(T.spearmanFloor).toBeGreaterThanOrEqual(0.9);
  });

  it('sets a cross-talk bound tighter than the loosest epsilon', () => {
    expect(T.crossTalk).toBeLessThan(Math.max(...DIMENSIONS.map((d) => T.epsilon[d])));
  });

  it('requires tone preservation to be a real separation, not noise', () => {
    expect(T.tonePreservationFloor).toBeGreaterThan(0.02);
  });
});
