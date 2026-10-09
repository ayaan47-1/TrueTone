import { encryptedStorage } from '../../../lib/encrypted-storage';
import { ShopifyRequestError, type ShopifyClient } from './client';
import { CART_CREATE, CART_LINES_ADD, CART_LINES_REMOVE, CART_LINES_UPDATE, CART_QUERY } from './graphql';
import { safeShopifyImage } from './product-mapper';
import type { Money, ShopifyCart, ShopifyCartLine } from './types';

export const SHOPIFY_CART_STORAGE_KEY = 'truetone.shopify.cart.id.v1';

interface CartNode {
  readonly id: string;
  readonly checkoutUrl: string;
  readonly totalQuantity: number;
  readonly cost: { readonly subtotalAmount: Money };
  readonly lines: { readonly nodes: readonly CartLineNode[] };
}

interface CartLineNode {
  readonly id: string;
  readonly quantity: number;
  readonly merchandise: {
    readonly id: string;
    readonly title: string;
    readonly availableForSale: boolean;
    readonly quantityAvailable?: number | null;
    readonly selectedOptions?: readonly { readonly name: string; readonly value: string }[];
    readonly price: Money;
    readonly compareAtPrice?: Money | null;
    readonly image?: { readonly url: string; readonly altText?: string | null; readonly width?: number | null; readonly height?: number | null } | null;
    readonly product: { readonly id: string; readonly handle: string; readonly title: string; readonly vendor: string };
  };
}

interface CartPayload {
  readonly cart: CartNode | null;
  readonly userErrors: readonly { readonly message: string }[];
}

interface CartIdStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function mapLine(node: CartLineNode): ShopifyCartLine {
  return {
    id: node.id,
    quantity: node.quantity,
    merchandise: {
      id: node.merchandise.id,
      title: node.merchandise.title,
      availableForSale: node.merchandise.availableForSale,
      quantityAvailable: node.merchandise.quantityAvailable ?? null,
      selectedOptions: node.merchandise.selectedOptions ?? [],
      price: node.merchandise.price,
      compareAtPrice: node.merchandise.compareAtPrice ?? null,
      image: safeShopifyImage(node.merchandise.image),
      product: node.merchandise.product,
    },
  };
}

function mapCart(node: CartNode): ShopifyCart {
  return {
    id: node.id,
    checkoutUrl: node.checkoutUrl,
    totalQuantity: node.totalQuantity,
    lines: node.lines.nodes.map(mapLine),
    subtotal: node.cost.subtotalAmount,
  };
}

function fromPayload(payload: CartPayload): ShopifyCart {
  if (payload.userErrors.length || !payload.cart) {
    throw new Error(payload.userErrors[0]?.message || 'Shopify cart was not returned');
  }
  return mapCart(payload.cart);
}

export interface CartAdapter {
  load(): Promise<ShopifyCart>;
  add(merchandiseId: string, quantity?: number): Promise<ShopifyCart>;
  update(lineId: string, quantity: number): Promise<ShopifyCart>;
  remove(lineId: string): Promise<ShopifyCart>;
  clearStoredId(): Promise<void>;
}

export function createCartAdapter(
  client: ShopifyClient,
  storage: CartIdStorage = encryptedStorage,
): CartAdapter {
  async function remember(cart: ShopifyCart): Promise<ShopifyCart> {
    await storage.setItem(SHOPIFY_CART_STORAGE_KEY, cart.id);
    return cart;
  }

  async function create(lines: readonly { readonly merchandiseId: string; readonly quantity: number }[] = []) {
    const data = await client.request<{ cartCreate: CartPayload }>(CART_CREATE, { lines });
    return remember(fromPayload(data.cartCreate));
  }

  async function existingId(): Promise<string | null> {
    return storage.getItem(SHOPIFY_CART_STORAGE_KEY);
  }

  return {
    async load() {
      const id = await existingId();
      if (!id) return create();
      let data: { cart: CartNode | null };
      try {
        data = await client.request<{ cart: CartNode | null }>(CART_QUERY, { id });
      } catch (error) {
        if (!(error instanceof ShopifyRequestError) || error.kind !== 'graphql') throw error;
        await storage.removeItem(SHOPIFY_CART_STORAGE_KEY);
        return create();
      }
      if (data.cart) return mapCart(data.cart);
      await storage.removeItem(SHOPIFY_CART_STORAGE_KEY);
      return create();
    },
    async add(merchandiseId, quantity = 1) {
      const id = await existingId();
      const lines = [{ merchandiseId, quantity }];
      if (!id) return create(lines);
      const data = await client.request<{ cartLinesAdd: CartPayload }>(CART_LINES_ADD, { cartId: id, lines });
      return remember(fromPayload(data.cartLinesAdd));
    },
    async update(lineId, quantity) {
      const id = await existingId();
      if (!id) throw new Error('No Shopify cart exists');
      const data = await client.request<{ cartLinesUpdate: CartPayload }>(CART_LINES_UPDATE, {
        cartId: id,
        lines: [{ id: lineId, quantity }],
      });
      return remember(fromPayload(data.cartLinesUpdate));
    },
    async remove(lineId) {
      const id = await existingId();
      if (!id) throw new Error('No Shopify cart exists');
      const data = await client.request<{ cartLinesRemove: CartPayload }>(CART_LINES_REMOVE, {
        cartId: id,
        lineIds: [lineId],
      });
      return remember(fromPayload(data.cartLinesRemove));
    },
    clearStoredId: () => storage.removeItem(SHOPIFY_CART_STORAGE_KEY),
  };
}
