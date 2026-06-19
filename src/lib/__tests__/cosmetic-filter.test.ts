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
test('catches inflected disease terms (plurals/suffixes)', () => {
  expect(findDiseaseTerms('these lesions look better')).not.toHaveLength(0);
  expect(findDiseaseTerms('looks cancerous')).not.toHaveLength(0);
  expect(findDiseaseTerms('several tumors')).not.toHaveLength(0);
  expect(findDiseaseTerms('multiple infections')).not.toHaveLength(0);
  expect(findDiseaseTerms('melanomas detected')).not.toHaveLength(0);
  expect(findDiseaseTerms('carcinomas present')).not.toHaveLength(0);
  expect(findDiseaseTerms('diseases of the skin')).not.toHaveLength(0);
});
test('approved cosmetic labels are not flagged by the disease filter', () => {
  expect(findDiseaseTerms('Looks well-hydrated')).toHaveLength(0);
  expect(findDiseaseTerms('Balanced')).toHaveLength(0);
  expect(findDiseaseTerms('More noticeable')).toHaveLength(0);
  expect(findDiseaseTerms('Sensitive-feeling')).toHaveLength(0);
});
