// src/features/shop/shelf.ts
// Pure Shop shelf composition for the v3 grid: category filter → search → sort. Post-scan
// the "match" sort reuses the match boundary's ranking (rankedForFilter) and attaches a
// qualitative tier; the 40..99 score itself never leaves this module. The "rating" sort
// ranks by SAMPLE ratings (sample-content.ts) and is offered only when those are enabled.
import type { MatchProfile, Product } from '../match/match-types';
import { rankedForFilter } from '../match/sort';
import { fitTier } from '../match/fit-tier';
import type { Filter, Finish, FitTier } from '../../content/makeup-vocab';
import { sampleRating } from './sample-content';

export type ShelfSort = 'match' | 'price' | 'rating';

/** Finish filter from the Sort & filter sheet; 'any' = no filter. */
export type FinishFilter = 'any' | Finish;

/** Sort labels; "match" reads "Featured" until there is a scan to rank by. */
export const SORT_LABELS: Record<ShelfSort, { scanned: string; neutral: string }> = {
  match: { scanned: 'Best match', neutral: 'Featured' },
  price: { scanned: 'Price: low to high', neutral: 'Price: low to high' },
  rating: { scanned: 'Top rated', neutral: 'Top rated' },
};

export interface ShelfItem {
  readonly product: Product;
  readonly isBestMatch: boolean;
  /** Post-scan only. */
  readonly tier?: FitTier;
}

export interface ShelfQuery {
  products: readonly Product[];
  profile?: MatchProfile;
  filter: Filter;
  query: string;
  sort: ShelfSort;
  finish?: FinishFilter;
}

function inFilter(p: Product, filter: Filter): boolean {
  return filter === 'all' ? p.category !== 'prep' : p.category === filter;
}

function matchesQuery(p: Product, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${p.name} ${p.shadeName ?? ''} ${p.finish}`.toLowerCase().includes(q);
}

/** The items the Shop grid shows, in order. Pure. */
export function shelfItems({ products, profile, filter, query, sort, finish = 'any' }: ShelfQuery): ShelfItem[] {
  const base: ShelfItem[] = profile
    ? rankedForFilter(products, profile, filter).map((s) => ({
        product: s.product,
        isBestMatch: s.isBestMatch,
        tier: fitTier(s.fit),
      }))
    : products.filter((p) => inFilter(p, filter)).map((product) => ({ product, isBestMatch: false }));

  const searched = base.filter(
    (i) => matchesQuery(i.product, query) && (finish === 'any' || i.product.finish === finish),
  );
  if (sort === 'rating') {
    const r = (i: ShelfItem): number => sampleRating(i.product.id).rating;
    return [...searched].sort((a, b) => r(b) - r(a)).map((i) => ({ ...i, isBestMatch: false }));
  }
  if (sort === 'price') {
    return [...searched]
      .sort((a, b) => a.product.price - b.product.price || a.product.name.localeCompare(b.product.name))
      .map((i) => ({ ...i, isBestMatch: false }));
  }
  // A search can hide the top-ranked item; the badge then goes to nobody rather than moving.
  return searched;
}
