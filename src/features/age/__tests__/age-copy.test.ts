// src/features/age/__tests__/age-copy.test.ts
import { trendCopy, assertTrendCopySafe } from '../age-copy';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import type { SkinAgeTrend } from '../age-types';

const mk = (direction: SkinAgeTrend['direction'], sampleCount = 3): SkinAgeTrend => ({
  direction, delta: 0.1, sampleCount,
});

describe('trendCopy', () => {
  it('produces copy for every direction and never emits a disease term', () => {
    for (const dir of ['fresher', 'steady', 'more-tired'] as const) {
      const { headline, sub } = trendCopy(mk(dir));
      expect(headline.length).toBeGreaterThan(0);
      expect(findDiseaseTerms(headline)).toHaveLength(0);
      expect(findDiseaseTerms(sub)).toHaveLength(0);
    }
  });

  it('explains there is no trend yet when only one scan exists', () => {
    const { sub } = trendCopy(mk('steady', 1));
    expect(sub.toLowerCase()).toContain('scan again');
  });

  it('describes appearance, not diagnosis (no "younger"/medical framing)', () => {
    const { headline } = trendCopy(mk('fresher'));
    expect(headline.toLowerCase()).toContain('look');
  });
});

describe('assertTrendCopySafe', () => {
  it('passes clean cosmetic copy and throws on a disease term', () => {
    expect(() => assertTrendCopySafe('Your skin looks fresher than last time')).not.toThrow();
    expect(() => assertTrendCopySafe('signs of eczema')).toThrow(/blocked/i);
  });
});
