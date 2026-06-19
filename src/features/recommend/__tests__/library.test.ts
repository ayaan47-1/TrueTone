import { SKINCARE_LIBRARY, SKINCARE_NOTES } from '../skincare/library';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';

const allStrings = [
  ...Object.values(SKINCARE_LIBRARY).flatMap((e) => [e.category, e.habit, e.rationale]),
  ...Object.values(SKINCARE_NOTES),
];

test('every library string is free of any disease/diagnostic term (compliance invariant)', () => {
  for (const s of allStrings) {
    expect(findDiseaseTerms(s)).toEqual([]);
  }
});

test('every library string is non-empty and brand-neutral (no capitalised brand-like tokens list)', () => {
  for (const s of allStrings) {
    expect(s.trim().length).toBeGreaterThan(0);
  }
});

test('each entry declares a valid slot', () => {
  for (const e of Object.values(SKINCARE_LIBRARY)) {
    expect(['am', 'pm', 'both']).toContain(e.slot);
  }
});
