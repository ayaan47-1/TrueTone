import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { PRODUCT_FIELDS } from '../graphql';
import { mapProductNode, pickPurchasableVariant } from '../product-mapper';

describe('Shopify product mapper', () => {
  it('maps Storefront supplier copy as-is without adding claims', () => {
    const product = mapProductNode({ ...PRODUCT_FIXTURE_NODE, description: 'Supplier-provided product details.' });

    expect(product.title).toBe('YENSA Bronzing Drops');
    expect(product.description).toBe('Supplier-provided product details.');
    expect(product.featuredImage?.url).toBe('https://cdn.shopify.com/s/files/test/yensa.png');
    expect(product.variants).toHaveLength(2);
    expect(PRODUCT_FIELDS).toContain('description');
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

  it("hides Shopify's synthetic single-variant title", () => {
    const product = mapProductNode({
      ...PRODUCT_FIXTURE_NODE,
      variants: {
        nodes: [{ ...PRODUCT_FIXTURE_NODE.variants.nodes[0], title: 'Default Title' }],
      },
    });

    expect(product.variants[0].title).toBe('');
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
