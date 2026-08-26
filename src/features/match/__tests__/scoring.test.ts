import { scoreProduct, baseShadeUndertoneFit, applyPreferences, clampFit } from '../scoring';
import type { Product, MatchProfile } from '../match-types';

const face = (over: Partial<Product> = {}): Product => ({
  id: 'p', name: 'Test', category: 'face', finish: 'natural', hasShimmer: false,
  shade: 5, undertone: 'warm', price: 20, ...over,
});
const profile = (over: Partial<MatchProfile> = {}): MatchProfile => ({
  shade: 5, undertone: 'warm', coverage: 'everyday', skips: [], ...over,
});

describe('clampFit', () => {
  it('clamps to 40..99 and rounds', () => {
    expect(clampFit(10)).toBe(40);
    expect(clampFit(120)).toBe(99);
    expect(clampFit(72.4)).toBe(72);
  });
});

describe('baseShadeUndertoneFit', () => {
  it('is 99 for an exact shade + undertone match', () => {
    expect(baseShadeUndertoneFit(face(), 5, 'warm')).toBe(99);
  });
  it('never drops below 40 for a far shade + opposite undertone', () => {
    expect(baseShadeUndertoneFit(face({ shade: 1, undertone: 'cool' }), 10, 'warm')).toBe(40);
  });
});

describe('applyPreferences', () => {
  it('everyday coverage makes no coverage adjustment', () => {
    expect(applyPreferences(80, face({ finish: 'glam' }), profile({ coverage: 'everyday' }))).toBe(80);
  });
  it('light coverage: +2 sheer, -9 glam', () => {
    expect(applyPreferences(80, face({ finish: 'sheer' }), profile({ coverage: 'light' }))).toBe(82);
    expect(applyPreferences(80, face({ finish: 'glam' }), profile({ coverage: 'light' }))).toBe(71);
  });
  it('glam coverage: +5 glam', () => {
    expect(applyPreferences(80, face({ finish: 'glam' }), profile({ coverage: 'glam' }))).toBe(85);
  });
  it('skip heavy_shimmer: -14 when the product shimmers', () => {
    expect(applyPreferences(80, face({ hasShimmer: true }), profile({ skips: ['heavy_shimmer'] }))).toBe(66);
  });
  it('skip drying_matte: +3 for a dewy finish', () => {
    expect(applyPreferences(80, face({ finish: 'dewy' }), profile({ skips: ['drying_matte'] }))).toBe(83);
  });
  it('fragrance and full_coverage skips make NO score adjustment', () => {
    expect(applyPreferences(80, face(), profile({ skips: ['fragrance', 'full_coverage'] }))).toBe(80);
  });
});

describe('scoreProduct', () => {
  it('always returns a fit within 40..99', () => {
    const s = scoreProduct(face(), profile());
    expect(s).toBeGreaterThanOrEqual(40);
    expect(s).toBeLessThanOrEqual(99);
  });
  it('floors a far glam product under light coverage at 40', () => {
    const s = scoreProduct(
      face({ finish: 'glam', shade: 1, undertone: 'cool' }),
      profile({ shade: 10, coverage: 'light' }),
    );
    expect(s).toBe(40);
  });
  it('ceils an exact-match glam product under glam coverage at 99', () => {
    // seed 99 (exact shade+undertone) + glam coverage +5 = 104 -> clamped to 99
    const s = scoreProduct(
      face({ finish: 'glam', shade: 5, undertone: 'warm' }),
      profile({ shade: 5, undertone: 'warm', coverage: 'glam' }),
    );
    expect(s).toBe(99);
  });
});
