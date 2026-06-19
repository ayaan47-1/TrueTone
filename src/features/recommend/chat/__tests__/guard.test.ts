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
