import { z } from 'zod';

export const inventoryLevelSchema = z.object({
  location_gid: z.string().startsWith('gid://shopify/Location/'),
  available: z.number().int(), online: z.boolean(),
}).strict();
export const variantSchema = z.object({
  variant_gid: z.string().startsWith('gid://shopify/ProductVariant/'),
  inventory_item_gid: z.string().startsWith('gid://shopify/InventoryItem/'),
  formula_key: z.string().min(1), formula_version: z.string().min(1),
  shade_name: z.string().min(1), vendor: z.string(), sku: z.string().nullable(), barcode: z.string().nullable(),
  published: z.boolean(), price: z.number().finite().nonnegative(), currency: z.string().length(3),
  levels: z.array(inventoryLevelSchema),
}).strict();
export const productSchema = z.object({
  product_gid: z.string().startsWith('gid://shopify/Product/'), variants: z.array(variantSchema),
}).strict();
export type ProductSnapshot = z.infer<typeof productSchema>;
export type InventorySnapshot = { inventory_item_gid: string; levels: z.infer<typeof inventoryLevelSchema>[] };

export interface CatalogueSource {
  product(id: string): Promise<ProductSnapshot | null>;
  inventory(id: string): Promise<InventorySnapshot>;
  products(): AsyncIterable<ProductSnapshot>;
}

export interface CatalogueStore {
  claim(id: string, topic: string): Promise<'claimed' | 'done' | 'busy'>;
  complete(id: string): Promise<void>;
  fail(id: string): Promise<void>;
  applyProduct(product: ProductSnapshot, observedAt: string): Promise<void>;
  deleteProduct(id: string, observedAt: string): Promise<void>;
  applyInventory(inventory: InventorySnapshot, observedAt: string): Promise<void>;
  finishReconcile(productIds: string[], startedAt: string): Promise<void>;
}
