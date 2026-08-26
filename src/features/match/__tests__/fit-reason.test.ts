import { fitReason, FIT_REASON_FRAGMENTS } from '../fit-reason';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import { catalog } from '../product-catalog';
import type { MatchProfile } from '../match-types';

describe('fit-reason compliance', () => {
  it('every static fragment is free of disease terms', () => {
    for (const f of FIT_REASON_FRAGMENTS) expect(findDiseaseTerms(f)).toEqual([]);
  });
  it('generated reasons across the catalog stay cosmetic-only', () => {
    const profiles: MatchProfile[] = [
      { shade: 3, undertone: 'cool', coverage: 'light', skips: ['drying_matte'] },
      { shade: 7, undertone: 'warm', coverage: 'glam', skips: ['heavy_shimmer'] },
    ];
    for (const profile of profiles) {
      for (const product of catalog) {
        expect(findDiseaseTerms(fitReason(product, profile))).toEqual([]);
      }
    }
  });
});
