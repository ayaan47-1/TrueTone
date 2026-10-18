import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { ShopifyProduct } from './types';

export const SHOPIFY_CATALOG_STORAGE_KEY = 'truetone.shopify.catalog.v1';

const moneySchema = z.object({ amount: z.string(), currencyCode: z.string() });
const imageSchema = z.object({
  url: z.string(),
  altText: z.string().nullable(),
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
  description: z.string().nullable(),
  featuredImage: imageSchema.nullable(),
  variants: z.array(variantSchema),
});
const snapshotSchema = z.object({
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

export function createCatalogCache(storage: CatalogStorage = AsyncStorage): CatalogCache {
  return {
    async read() {
      const raw = await storage.getItem(SHOPIFY_CATALOG_STORAGE_KEY);
      if (!raw) return null;
      try {
        const parsed = snapshotSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
      } catch {
        // Remove malformed cache data below.
      }
      await storage.removeItem(SHOPIFY_CATALOG_STORAGE_KEY);
      return null;
    },
    async write(snapshot) {
      await storage.setItem(SHOPIFY_CATALOG_STORAGE_KEY, JSON.stringify(snapshot));
    },
  };
}
