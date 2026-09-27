// scripts/__tests__/check-no-medical-claims.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findClaimsInSource, guardedFiles } from '../check-no-medical-claims.mjs';

test('flags a banned claim in copy', () => {
  assert.deepEqual(findClaimsInSource("export const x = 'This serum is hypoallergenic.';"), ['hypoallergenic']);
});
test('flags a diagnosis of the user', () => {
  assert.deepEqual(findClaimsInSource("title: \"You're allergic to fragrance\""), ["you're allergic"]);
});
test('allows a banned phrase inside a negation or clinician redirect', () => {
  assert.deepEqual(findClaimsInSource("'We can not tell you if a product is safe for you.'"), []);
  assert.deepEqual(findClaimsInSource("'For patch test questions, talk to a doctor.'"), []);
});
test('a negated promise still fires (won\'t irritate can\'t excuse itself)', () => {
  assert.deepEqual(findClaimsInSource("'This won\\'t irritate.'"), ["won't irritate"]);
});
test('clean copy passes', () => {
  assert.deepEqual(findClaimsInSource("'Lists fragrance, which is on your flag list.'"), []);
});
test('guards content, *copy* files, chat prompt and allergen screens; never the blocklist itself', () => {
  const files = guardedFiles();
  assert.ok(files.includes('src/content/cosmetic-vocab.ts'));
  assert.ok(files.includes('src/features/consent/consent-copy.ts'));
  assert.ok(files.includes('src/features/recommend/chat/prompt.ts'));
  assert.ok(files.includes('src/features/shop/ProductCard.tsx'));
  assert.ok(!files.includes('src/content/medical-claims.ts'));
  assert.ok(files.every((f) => !f.includes('__tests__')));
});
