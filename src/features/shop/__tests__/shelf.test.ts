// Pure Shop shelf composition: category filter + search + sort over the ranked catalog.
import { catalog } from '../../match/product-catalog';
import type { MatchProfile } from '../../match/match-types';
import { shelfItems, SORT_LABELS } from '../shelf';

const PROFILE: MatchProfile = { shade: 5, undertone: 'warm', coverage: 'everyday', skips: [] };

describe('shelfItems', () => {
  test('pre-scan keeps catalog order, no best match, no tier', () => {
    const items = shelfItems({ products: catalog, filter: 'all', query: '', sort: 'match' });
    expect(items[0].product.id).toBe(catalog[0].id);
    expect(items.some((i) => i.isBestMatch)).toBe(false);
    expect(items.every((i) => i.tier === undefined)).toBe(true);
  });

  test('post-scan ranks best-first, badges only the top card, and attaches a tier', () => {
    const items = shelfItems({ products: catalog, profile: PROFILE, filter: 'face', query: '', sort: 'match' });
    expect(items.filter((i) => i.isBestMatch)).toHaveLength(1);
    expect(items[0].isBestMatch).toBe(true);
    expect(items[0].tier).toBe('great');
  });

  test('price sort orders low to high and drops the best-match badge', () => {
    const items = shelfItems({ products: catalog, profile: PROFILE, filter: 'all', query: '', sort: 'price' });
    const prices = items.map((i) => i.product.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(items.some((i) => i.isBestMatch)).toBe(false);
  });

  test('search matches the product name case-insensitively', () => {
    const items = shelfItems({ products: catalog, filter: 'all', query: 'CONCEALER', sort: 'match' });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => /concealer/i.test(i.product.name))).toBe(true);
  });

  test('search also matches the shade name', () => {
    const items = shelfItems({ products: catalog, filter: 'all', query: 'mocha', sort: 'match' });
    expect(items.map((i) => i.product.id)).toEqual(['ver-dewy-11']);
  });

  test('category filter applies before search', () => {
    const items = shelfItems({ products: catalog, filter: 'lips', query: '', sort: 'match' });
    expect(items.every((i) => i.product.category === 'lips')).toBe(true);
  });

  test('no ratings-based sort exists (no real review data)', () => {
    expect(Object.keys(SORT_LABELS)).toEqual(['match', 'price']);
  });
});
