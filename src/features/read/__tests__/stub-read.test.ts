import { stubRead, STUB_MODEL_VERSION } from '../stub-read';
import { DIMENSIONS } from '../../../content/cosmetic-vocab';

describe('stubRead', () => {
  it('flags itself as a stub with a stub model version', () => {
    const r = stubRead();
    expect(r.isStub).toBe(true);
    expect(r.modelVersion).toBe(STUB_MODEL_VERSION);
  });

  it('produces a score for every dimension, each within [0, 1]', () => {
    const { scores } = stubRead();
    expect(Object.keys(scores).sort()).toEqual([...DIMENSIONS].sort());
    for (const d of DIMENSIONS) {
      expect(scores[d]).toBeGreaterThanOrEqual(0);
      expect(scores[d]).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic (stable demo)', () => {
    expect(stubRead().scores).toEqual(stubRead().scores);
  });

  it('returns an approved skin-type feel', () => {
    expect(['dry', 'oily', 'combination', 'sensitive']).toContain(stubRead().skinType);
  });
});
