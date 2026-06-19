import { isMedicalQuery, REFERRAL_MESSAGE } from '../refusal';

test.each([
  'is this mole cancer?',
  'I think I have melanoma',
  'can you check this lesion',
  'does this look like skin cancer',
  'is this a carcinoma',
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
