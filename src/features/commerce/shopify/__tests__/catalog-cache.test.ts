import { createCatalogCache, SHOPIFY_CATALOG_STORAGE_KEY } from '../catalog-cache';
import { PRODUCT_FIXTURE_NODE } from '../fixtures/products';
import { mapProductNode } from '../product-mapper';

describe('Shopify catalog cache', () => {
  const storage = {
    getItem: jest.fn<Promise<string | null>, [string]>(),
    setItem: jest.fn<Promise<void>, [string, string]>(),
    removeItem: jest.fn<Promise<void>, [string]>(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('persists and restores a dated product snapshot', async () => {
    const products = [mapProductNode(PRODUCT_FIXTURE_NODE)];
    storage.getItem.mockResolvedValue(null);
    const cache = createCatalogCache(storage);

    await cache.write({ products, updatedAt: 1_760_811_600_000 });
    const serialized = storage.setItem.mock.calls[0][1];
    storage.getItem.mockResolvedValue(serialized);

    await expect(cache.read()).resolves.toEqual({ products, updatedAt: 1_760_811_600_000 });
    expect(storage.setItem).toHaveBeenCalledWith(SHOPIFY_CATALOG_STORAGE_KEY, expect.any(String));
  });

  it('removes malformed persisted data instead of trusting it', async () => {
    storage.getItem.mockResolvedValue('{"products":"not-an-array"}');
    const cache = createCatalogCache(storage);

    await expect(cache.read()).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(SHOPIFY_CATALOG_STORAGE_KEY);
  });

  it('drops cached featured and variant images outside the Shopify CDN', async () => {
    const product = mapProductNode(PRODUCT_FIXTURE_NODE);
    const unsafeImage = {
      url: 'https://tracking.example/product.jpg',
      altText: 'Untrusted image',
      width: 100,
      height: 100,
    };
    const snapshot = {
      products: [{
        ...product,
        featuredImage: unsafeImage,
        variants: product.variants.map((variant) => ({ ...variant, image: unsafeImage })),
      }],
      updatedAt: 1_760_811_600_000,
    };
    storage.getItem.mockResolvedValue(JSON.stringify(snapshot));

    const restored = await createCatalogCache(storage).read();

    expect(restored?.products[0].featuredImage).toBeNull();
    expect(restored?.products[0].variants[0].image).toBeNull();
  });
});
