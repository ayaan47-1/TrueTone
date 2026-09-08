import { scoreAll, applyFilter, rank, rankedForFilter } from '../sort';
import type { Product, MatchProfile } from '../match-types';

const p = (id: string, over: Partial<Product> = {}): Product => ({
  id, name: id, category: 'face', finish: 'natural', hasShimmer: false,
  shade: 5, undertone: 'warm', price: 10, ...over,
});
const profile: MatchProfile = { shade: 5, undertone: 'warm', coverage: 'everyday', skips: [] };

describe('rank', () => {
  it('sorts best-first and badges only the top item', () => {
    const ranked = rank(scoreAll([p('a', { shade: 9 }), p('b', { shade: 5 })], profile));
    expect(ranked[0].product.id).toBe('b');
    expect(ranked[0].isBestMatch).toBe(true);
    expect(ranked[1].isBestMatch).toBe(false);
  });
});

describe('applyFilter', () => {
  const scored = scoreAll(
    [p('f', { category: 'face' }), p('e', { category: 'eyes' }), p('pr', { category: 'prep' })],
    profile,
  );
  it('all excludes prep', () => {
    expect(applyFilter(scored, 'all').map((s) => s.product.id).sort()).toEqual(['e', 'f']);
  });
  it('face keeps only face', () => {
    expect(applyFilter(scored, 'face').map((s) => s.product.id)).toEqual(['f']);
  });
});

describe('rankedForFilter', () => {
  it('re-sorts per filter and badges that view top item', () => {
    const ranked = rankedForFilter(
      [p('f', { category: 'face', shade: 9 }), p('e', { category: 'eyes', shade: 5 })],
      profile,
      'eyes',
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].product.id).toBe('e');
    expect(ranked[0].isBestMatch).toBe(true);
  });
  it('breaks fit ties alphabetically by product name', () => {
    const ranked = rank(scoreAll([p('zebra'), p('alpha')], profile));
    expect(ranked.map((s) => s.product.id)).toEqual(['alpha', 'zebra']);
  });
  it('handles an empty catalog without throwing', () => {
    expect(rankedForFilter([], profile, 'all')).toEqual([]);
  });
});
