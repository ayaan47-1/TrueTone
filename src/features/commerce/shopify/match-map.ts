import type { ShopifyProduct, ShopifyVariant } from './types';

export interface ReviewedMatchEntry {
  readonly localProductId: string;
  readonly shopifyProductId: string;
  readonly shopifyVariantId: string;
  readonly review: {
    readonly reviewer: string;
    readonly reviewedAt: string;
  };
}

/**
 * Manually reviewed join table. Keep this empty until merchandising approves an exact pair.
 * Never derive this from Shopify copy, tags, analytics, or a person's scan/read state.
 */
export const REVIEWED_MATCH_MAP: readonly ReviewedMatchEntry[] = [];

export interface ReviewedProductMatch {
  readonly localProductId: string;
  readonly product: ShopifyProduct;
  readonly variant: ShopifyVariant;
}

export function joinReviewedMatches(
  products: readonly ShopifyProduct[],
  entries: readonly ReviewedMatchEntry[] = REVIEWED_MATCH_MAP,
): readonly ReviewedProductMatch[] {
  const productsById = new Map(products.map((product) => [product.id, product]));
  return entries.flatMap((entry) => {
    const product = productsById.get(entry.shopifyProductId);
    const variant = product?.variants.find(({ id }) => id === entry.shopifyVariantId);
    return product && variant ? [{ localProductId: entry.localProductId, product, variant }] : [];
  });
}
