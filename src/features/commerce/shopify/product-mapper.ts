import type { Money, ShopifyImage, ShopifyProduct, ShopifyVariant } from './types';

export const SHOPIFY_MEDIA_HOSTS = new Set(['cdn.shopify.com']);

/** Reviewed, local-only display copy. Shopify/supplier descriptions are never rendered directly. */
const APPROVED_PRODUCT_COPY: Readonly<Record<string, string>> = {};

interface ImageNode {
  readonly url: string;
  readonly altText?: string | null;
  readonly width?: number | null;
  readonly height?: number | null;
}

interface VariantNode {
  readonly id: string;
  readonly title: string;
  readonly availableForSale: boolean;
  readonly quantityAvailable?: number | null;
  readonly selectedOptions?: readonly { readonly name: string; readonly value: string }[];
  readonly price: Money;
  readonly compareAtPrice?: Money | null;
  readonly image?: ImageNode | null;
}

export interface ProductNode {
  readonly id: string;
  readonly handle: string;
  readonly title: string;
  readonly vendor: string;
  readonly description?: string | null;
  readonly featuredImage?: ImageNode | null;
  readonly variants: { readonly nodes: readonly VariantNode[] };
}

export function safeShopifyImage(node?: ImageNode | null): ShopifyImage | null {
  if (!node) return null;
  try {
    const url = new URL(node.url);
    if (url.protocol !== 'https:' || !SHOPIFY_MEDIA_HOSTS.has(url.hostname)) return null;
    return {
      url: url.toString(),
      altText: node.altText?.trim() || null,
      width: node.width ?? null,
      height: node.height ?? null,
    };
  } catch {
    return null;
  }
}

function mapVariant(node: VariantNode): ShopifyVariant {
  return {
    id: node.id,
    title: node.title,
    availableForSale: node.availableForSale,
    quantityAvailable: node.quantityAvailable ?? null,
    selectedOptions: node.selectedOptions ?? [],
    price: node.price,
    compareAtPrice: node.compareAtPrice ?? null,
    image: safeShopifyImage(node.image),
  };
}

export function mapProductNode(node: ProductNode): ShopifyProduct {
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    vendor: node.vendor,
    description: APPROVED_PRODUCT_COPY[node.id] ?? null,
    featuredImage: safeShopifyImage(node.featuredImage),
    variants: node.variants.nodes.map(mapVariant),
  };
}

export function pickPurchasableVariant(product: ShopifyProduct): ShopifyVariant | null {
  return product.variants.find((variant) => variant.availableForSale) ?? null;
}
