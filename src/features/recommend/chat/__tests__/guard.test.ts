import { guardReply, FALLBACK_MESSAGE } from '../guard';

test('passes through clean cosmetic replies unchanged', () => {
  const out = guardReply('The SPF step helps your skin look even over time.');
  expect(out.blocked).toBe(false);
  expect(out.safe).toContain('SPF');
});

test('fails closed on a disease term, returning the fallback', () => {
  const out = guardReply('This looks like eczema and you should treat the dermatitis.');
  expect(out.blocked).toBe(true);
  expect(out.safe).toBe(FALLBACK_MESSAGE);
});

test('fallback redirects to a dermatologist without diagnosing', () => {
  expect(FALLBACK_MESSAGE.toLowerCase()).toContain('dermatologist');
});

// Output guard also fails closed on the shared MEDICAL_CLAIM_BLOCKLIST (compliance.md §3.2.3).
test.each([
  'This moisturizer is hypoallergenic and safe for you.',
  'You are allergic to fragrance, so skip it.',
  'Do a patch test on your arm first.',
  'It repairs your barrier overnight.',
])('fails closed on a medical claim: %s', (reply) => {
  const out = guardReply(reply);
  expect(out.blocked).toBe(true);
  expect(out.safe).toBe(FALLBACK_MESSAGE);
});

test('a clean reply that touches allergies gets the disclaimer injected, not left to the model', () => {
  const { ALLERGEN_DISCLAIMER } = require('../../../../content/medical-claims');
  const out = guardReply('The ingredient list for this product includes fragrance.');
  expect(out.blocked).toBe(false);
  expect(out.safe).not.toContain(ALLERGEN_DISCLAIMER);
  const topic = guardReply('Allergies are personal; the label lists fragrance.');
  expect(topic.blocked).toBe(false);
  expect(topic.safe).toContain(ALLERGEN_DISCLAIMER);
});
