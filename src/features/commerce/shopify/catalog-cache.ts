import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { safeShopifyImage } from './product-mapper';
import type { ShopifyProduct } from './types';

export const SHOPIFY_CATALOG_STORAGE_KEY = 'truetone.shopify.catalog.v2';
const LEGACY_SHOPIFY_CATALOG_STORAGE_KEY = 'truetone.shopify.catalog.v1';
const SHOPIFY_CATALOG_SCHEMA_VERSION = 2;

const moneySchema = z.object({ amount: z.string(), currencyCode: z.string() });
const imageSchema = z.object({
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});
const variantSchema = z.object({
  id: z.string(),
  title: z.string(),
  availableForSale: z.boolean(),
  quantityAvailable: z.number().nullable(),
  selectedOptions: z.array(z.object({ name: z.string(), value: z.string() })),
  price: moneySchema,
  compareAtPrice: moneySchema.nullable(),
  image: imageSchema.nullable(),
});
const productSchema = z.object({
  id: z.string(),
  handle: z.string(),
  title: z.string(),
  vendor: z.string(),
  featuredImage: imageSchema.nullable(),
  variants: z.array(variantSchema),
});
const snapshotSchema = z.object({
  schemaVersion: z.literal(SHOPIFY_CATALOG_SCHEMA_VERSION),
  products: z.array(productSchema),
  updatedAt: z.number().int().nonnegative(),
});

export interface CatalogSnapshot {
  readonly products: readonly ShopifyProduct[];
  readonly updatedAt: number;
}

interface CatalogStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface CatalogCache {
  read(): Promise<CatalogSnapshot | null>;
  write(snapshot: CatalogSnapshot): Promise<void>;
}

function sanitizeCachedProduct(product: ShopifyProduct): ShopifyProduct {
  return {
    ...product,
    featuredImage: safeShopifyImage(product.featuredImage),
    variants: product.variants.map((variant) => ({
      ...variant,
      image: safeShopifyImage(variant.image),
    })),
  };
}

export function createCatalogCache(storage: CatalogStorage = AsyncStorage): CatalogCache {
  return {
    async read() {
      try {
        await storage.removeItem(LEGACY_SHOPIFY_CATALOG_STORAGE_KEY);
      } catch {
        // A failed legacy cleanup must not block the current cache or live request.
      }
      const raw = await storage.getItem(SHOPIFY_CATALOG_STORAGE_KEY);
      if (!raw) return null;
      try {
        const parsed = snapshotSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          return {
            products: parsed.data.products.map(sanitizeCachedProduct),
            updatedAt: parsed.data.updatedAt,
          };
        }
      } catch {
        // Remove malformed cache data below.
      }
      await storage.removeItem(SHOPIFY_CATALOG_STORAGE_KEY);
      return null;
    },
    async write(snapshot) {
      await storage.setItem(SHOPIFY_CATALOG_STORAGE_KEY, JSON.stringify({
        schemaVersion: SHOPIFY_CATALOG_SCHEMA_VERSION,
        ...snapshot,
      }));
    },
  };
}
