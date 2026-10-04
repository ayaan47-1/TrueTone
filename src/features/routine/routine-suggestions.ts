// src/features/routine/routine-suggestions.ts
// Pure ordering of products for the "add a routine step" picker: the user's previously
// purchased items first, then their saved items, then the rest of the shop catalog. Local
// data only -- ids come from on-device stores and resolve against the bundled catalog.
import { catalog as defaultCatalog } from '../match/product-catalog';
import type { Product } from '../match/match-types';

export type SuggestionSource = 'purchased' | 'saved' | 'catalog';

export interface ProductSuggestion {
  product: Product;
  source: SuggestionSource;
}

export interface SuggestInput {
  purchasedIds: readonly string[];
  savedIds: readonly string[];
  /** Ids already in the slot being edited -- never suggested again. */
  exclude: readonly string[];
  catalog?: readonly Product[];
}

export function suggestProducts({
  purchasedIds,
  savedIds,
  exclude,
  catalog = defaultCatalog,
}: SuggestInput): ProductSuggestion[] {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const seen = new Set(exclude);
  const out: ProductSuggestion[] = [];
  const take = (ids: readonly string[], source: SuggestionSource): void => {
    for (const id of ids) {
      const product = byId.get(id);
      if (!product || seen.has(id)) continue;
      seen.add(id);
      out.push({ product, source });
    }
  };
  take(purchasedIds, 'purchased');
  take(savedIds, 'saved');
  take(catalog.map((p) => p.id), 'catalog');
  return out;
}
