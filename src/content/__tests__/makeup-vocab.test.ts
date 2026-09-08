import { MAKEUP_APPROVED_LABELS } from '../makeup-vocab';
import { findDiseaseTerms } from '../../lib/cosmetic-filter';

describe('makeup vocabulary compliance', () => {
  it('every approved makeup label is free of disease terms', () => {
    for (const label of MAKEUP_APPROVED_LABELS) expect(findDiseaseTerms(label)).toEqual([]);
  });
});
