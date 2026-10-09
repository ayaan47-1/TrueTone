import { REVIEWED_MATCH_MAP, joinReviewedMatches } from '../match-map';
import { mapProductNode } from '../product-mapper';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';

describe('reviewed local match map', () => {
  it('ships empty until a mapping is reviewed', () => {
    expect(REVIEWED_MATCH_MAP).toEqual([]);
  });

  it('joins only exact reviewed Shopify product and variant IDs', () => {
    const product = mapProductNode(PRODUCT_FIXTURE_NODE);
    const joined = joinReviewedMatches([product], [
      {
        localProductId: 'local-yensa-bronzing-drops',
        shopifyProductId: product.id,
        shopifyVariantId: product.variants[1].id,
        review: { reviewer: 'fixture', reviewedAt: '2026-10-08' },
      },
    ]);

    expect(joined).toEqual([
      {
        localProductId: 'local-yensa-bronzing-drops',
        product,
        variant: product.variants[1],
      },
    ]);
  });
});
