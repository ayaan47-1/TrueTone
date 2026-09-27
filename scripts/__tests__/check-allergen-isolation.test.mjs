// scripts/__tests__/check-allergen-isolation.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importsAllergenData, allergenNetworkUse, scanIsolation } from '../check-allergen-isolation.mjs';

test('flags an import of the allergen store or profile', () => {
  assert.equal(importsAllergenData("import { loadAllergenProfile } from '../allergens/allergen-store';"), true);
  assert.equal(importsAllergenData("const p = require('../../features/allergens/profile')"), true);
  assert.equal(importsAllergenData("import x from './features/allergens/use-allergen-profile'"), true);
});
test('ignores unrelated imports and the copy file', () => {
  assert.equal(importsAllergenData("import { ALLERGEN_COPY } from '../content/allergen-copy';"), false);
  assert.equal(importsAllergenData("import { supabase } from './supabase';"), false);
});
test('flags network use inside the allergen feature, except the consent receipt module', () => {
  assert.deepEqual(allergenNetworkUse('src/features/allergens/allergen-store.ts', "import { supabase } from '../../lib/supabase'"), ['supabase']);
  assert.deepEqual(allergenNetworkUse('src/features/allergens/profile.ts', "await fetch('https://x')"), ['fetch(']);
  assert.deepEqual(allergenNetworkUse('src/features/allergens/health-consent.ts', "import { supabase } from '../../lib/supabase'"), []);
});
test('the current tree is clean', () => {
  assert.deepEqual(scanIsolation(), []);
});
