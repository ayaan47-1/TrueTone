import { isMedicalQuery, REFERRAL_MESSAGE } from '../refusal';

test.each([
  'is this mole cancer?',
  'I think I have melanoma',
  'can you check this lesion',
  'does this look like skin cancer',
  'is this a carcinoma',
  'could this be precancerous?',
  'is this a cyst?',
  'does this look normal to you?',
])('flags medical query: %s', (q) => {
  expect(isMedicalQuery(q)).toBe(true);
});

test.each([
  'why is vitamin C in my routine?',
  'how often should I use the exfoliant?',
  'what does the SPF step do',
])('does not flag cosmetic query: %s', (q) => {
  expect(isMedicalQuery(q)).toBe(false);
});

test('referral message points to a dermatologist and does not diagnose', () => {
  expect(REFERRAL_MESSAGE.toLowerCase()).toContain('dermatologist');
});

// Founder hard rule: the app NEVER gives medical or allergy advice (compliance.md §3.2).
import { isAllergyQuery, ALLERGY_REFUSAL } from '../refusal';
import { findMedicalClaims, ALLERGEN_DISCLAIMER } from '../../../../content/medical-claims';
import { findDiseaseTerms } from '../../../../lib/cosmetic-filter';

test.each([
  'am i allergic to this?',
  'Is this safe for me?',
  'is this safe for my skin',
  'will I react to the serum?',
  'is it hypoallergenic',
  'should I patch test first',
  'I had an allergic reaction, what now',
  'I have a nut allergy, can I use this',
  'what medication should I take for this rash',
  'can I use it with my prescription cream',
])('flags allergy / medical-advice query: %s', (q) => {
  expect(isAllergyQuery(q)).toBe(true);
});

test.each([
  'why is vitamin C in my routine?',
  'what does the SPF step do',
  'which foundation shade matches me',
])('does not flag cosmetic query as allergy: %s', (q) => {
  expect(isAllergyQuery(q)).toBe(false);
});

test('allergy refusal redirects to a doctor or dermatologist and carries the disclaimer', () => {
  expect(ALLERGY_REFUSAL.toLowerCase()).toContain('doctor or dermatologist');
  expect(ALLERGY_REFUSAL).toContain(ALLERGEN_DISCLAIMER);
});

test('allergy refusal itself passes both blocklists', () => {
  expect(findDiseaseTerms(ALLERGY_REFUSAL)).toEqual([]);
  expect(findMedicalClaims(ALLERGY_REFUSAL)).toEqual([]);
});
