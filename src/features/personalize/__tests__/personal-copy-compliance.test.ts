import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import { FRESHNESS_POLARITY } from '../../age/skin-age-trend';
import { personalCopy } from '../personal-copy';
import type { PersonalDeviation } from '../types';

test('every personalization sentence is free of disease/diagnostic terms', () => {
  for (const d of DIMENSIONS) {
    for (const status of ['above', 'below'] as const) {
      const polarity = FRESHNESS_POLARITY[d];
      const favorable =
        polarity === 0 ? null : polarity === 1 ? status === 'above' : status === 'below';
      const deviation = { [d]: { status, z: 2, favorable } } as PersonalDeviation;
      for (const message of personalCopy(deviation)) {
        expect(findDiseaseTerms(message)).toEqual([]);
      }
    }
  }
});
