import { SEED_POSTS, SEED_ROUTINES, SEED_CREATORS } from '../community-seed';
import { catalog } from '../../match/product-catalog';

const catalogIds = new Set(catalog.map((product) => product.id));

test('every seeded creator has a normalized-shape username and a null (no-network) avatar', () => {
  expect(SEED_CREATORS.length).toBeGreaterThan(0);
  for (const creator of SEED_CREATORS) {
    expect(creator.avatarUri).toBeNull();
    expect(creator.username).toMatch(/^[a-z][a-z0-9_]*$/);
  }
});

test('every post tags only real catalog products', () => {
  expect(SEED_POSTS.length).toBeGreaterThan(0);
  for (const post of SEED_POSTS) {
    for (const id of post.taggedProductIds) {
      expect(catalogIds.has(id)).toBe(true);
    }
  }
});

test('every routine tags only real catalog products and has at least one step', () => {
  expect(SEED_ROUTINES.length).toBeGreaterThan(0);
  for (const routine of SEED_ROUTINES) {
    expect(routine.steps.length).toBeGreaterThan(0);
    for (const id of routine.taggedProductIds) {
      expect(catalogIds.has(id)).toBe(true);
    }
  }
});

test('no post or routine media/product references a network URL', () => {
  for (const post of SEED_POSTS) {
    for (const item of post.media) {
      expect(item.swatch).not.toMatch(/^https?:\/\//);
    }
  }
});
