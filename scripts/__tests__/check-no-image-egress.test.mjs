// scripts/__tests__/check-no-image-egress.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findEgress } from '../check-no-image-egress.mjs';

test('flags supabase storage usage', () => {
  assert.deepEqual(findEgress("supabase.storage.from('x').upload(uri)"), ['.storage', 'upload']);
});
test('flags raw network upload of an image', () => {
  assert.deepEqual(findEgress('fetch(url, { body: imageUri })'), ['imageUri']);
});
test('clean read code passes', () => {
  assert.deepEqual(findEgress('const t = normalizeToTensor(rgb, 224, 224)'), []);
});
