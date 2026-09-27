import { ALLERGEN_GROUPS, REFERRAL_GROUP_IDS, groupById } from '../allergen-groups';
import { INGREDIENTS, ingredientById, TAXONOMY_VERSION } from '../dictionary';

test('the brief\'s 10 groups, in order', () => {
  expect(ALLERGEN_GROUPS.map((g) => g.id)).toEqual([
    'fragrance', 'linalool', 'limonene', 'mit', 'formaldehyde_releasers', 'parabens',
    'latex', 'ppd', 'sulfates', 'botanicals',
  ]);
});

test('latex and PPD are referral-only (founder: see-a-doctor note, not a product flag)', () => {
  expect([...REFERRAL_GROUP_IDS].sort()).toEqual(['latex', 'ppd']);
  expect(groupById('latex')?.referralOnly).toBe(true);
  expect(groupById('fragrance')?.referralOnly).toBe(false);
});

test('every group member is a real dictionary id', () => {
  for (const g of ALLERGEN_GROUPS) for (const m of g.members) expect(ingredientById(m)).toBeDefined();
});

test('dictionary ids are unique and the taxonomy is versioned', () => {
  expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
  expect(TAXONOMY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
});
