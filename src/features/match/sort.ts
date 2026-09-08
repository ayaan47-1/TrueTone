// src/features/match/sort.ts
// Score, filter, and rank products per person AND per Shop filter tab.
import type { Product, MatchProfile, ScoredProduct } from './match-types';
import type { Filter } from '../../content/makeup-vocab';
import { scoreProduct } from './scoring';
import { fitReason } from './fit-reason';

/** Score every product for this person (no ranking yet). */
export function scoreAll(products: readonly Product[], profile: MatchProfile): ScoredProduct[] {
  return products.map((product) => ({
    product,
    fit: scoreProduct(product, profile),
    reason: fitReason(product, profile),
    isBestMatch: false,
  }));
}

/** Keep only the products a Shop filter tab shows. 'all' = the non-prep shelf. */
export function applyFilter(scored: readonly ScoredProduct[], filter: Filter): ScoredProduct[] {
  if (filter === 'all') return scored.filter((s) => s.product.category !== 'prep');
  return scored.filter((s) => s.product.category === filter);
}

/** Sort best-first (stable, tiebreak by name) and badge only the single top item. */
export function rank(scored: readonly ScoredProduct[]): ScoredProduct[] {
  const sorted = [...scored].sort(
    (a, b) => b.fit - a.fit || a.product.name.localeCompare(b.product.name),
  );
  return sorted.map((s, i) => ({ ...s, isBestMatch: i === 0 }));
}

/** Full per-person, per-filter ranked list with the Best-match badge applied. */
export function rankedForFilter(
  products: readonly Product[],
  profile: MatchProfile,
  filter: Filter,
): ScoredProduct[] {
  return rank(applyFilter(scoreAll(products, profile), filter));
}
