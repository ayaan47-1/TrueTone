import type { ShopifyClient } from './client';
import { PRODUCT_BY_HANDLE_QUERY, PRODUCTS_QUERY } from './graphql';
import { mapProductNode, type ProductNode } from './product-mapper';
import type { ShopifyProduct } from './types';

export interface ShopifyCatalog {
  list(first?: number): Promise<readonly ShopifyProduct[]>;
  getByHandle(handle: string): Promise<ShopifyProduct | null>;
}

export function createShopifyCatalog(client: ShopifyClient): ShopifyCatalog {
  return {
    async list(first = 30) {
      const data = await client.request<{ products: { nodes: ProductNode[] } }>(PRODUCTS_QUERY, { first });
      return data.products.nodes.map(mapProductNode);
    },
    async getByHandle(handle) {
      const data = await client.request<{ product: ProductNode | null }>(PRODUCT_BY_HANDLE_QUERY, { handle });
      return data.product ? mapProductNode(data.product) : null;
    },
  };
}
