// src/lib/__tests__/cosmetic-filter.test.ts
import { findDiseaseTerms, isApprovedLabel, assertCosmetic } from '../cosmetic-filter';
import { DISEASE_BLOCKLIST, APPROVED_LABELS } from '../../content/cosmetic-vocab';

test('every blocklisted disease term is detected (word-boundary)', () => {
  for (const term of DISEASE_BLOCKLIST) {
    expect(findDiseaseTerms(`you have ${term} here`)).toContain(term);
  }
});
test('does not false-positive on substrings', () => {
  expect(findDiseaseTerms('conditioner and conditional')).toEqual([]); // not "condition"
});
test('approved labels pass, unknown labels fail', () => {
  for (const label of APPROVED_LABELS) expect(isApprovedLabel(label)).toBe(true);
  expect(isApprovedLabel('mild acne')).toBe(false);
  expect(isApprovedLabel('totally made up')).toBe(false);
});
test('assertCosmetic throws on a disease term and on an unknown label', () => {
  expect(() => assertCosmetic(['Balanced'])).not.toThrow();
  expect(() => assertCosmetic(['melanoma'])).toThrow(/blocked disease term/);
  expect(() => assertCosmetic(['glowing goddess skin'])).toThrow(/not in approved vocabulary/);
});
