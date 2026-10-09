import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode, pickPurchasableVariant } from '../product-mapper';

describe('Shopify product mapper', () => {
  it('maps a Storefront node to the app DTO without inventing approved copy', () => {
    const product = mapProductNode({ ...PRODUCT_FIXTURE_NODE, description: 'Unreviewed supplier marketing copy' });

    expect(product.title).toBe('YENSA Bronzing Drops');
    expect(product.description).toBeNull();
    expect(product.featuredImage?.url).toBe('https://cdn.shopify.com/s/files/test/yensa.png');
    expect(product.variants).toHaveLength(2);
  });

  it('drops media outside the exact HTTPS host allowlist', () => {
    const product = mapProductNode({
      ...PRODUCT_FIXTURE_NODE,
      featuredImage: {
        ...PRODUCT_FIXTURE_NODE.featuredImage,
        url: 'https://images.example.com/yensa.png',
      },
    });

    expect(product.featuredImage).toBeNull();
  });

  it('selects the first available variant and returns null when none are purchasable', () => {
    const product = mapProductNode(PRODUCT_FIXTURE_NODE);
    expect(pickPurchasableVariant(product)?.id).toBe('gid://shopify/ProductVariant/2');
    expect(
      pickPurchasableVariant({
        ...product,
        variants: product.variants.map((variant) => ({ ...variant, availableForSale: false })),
      }),
    ).toBeNull();
  });
});
