export interface Money {
  readonly amount: string;
  readonly currencyCode: string;
}

export interface ShopifyImage {
  readonly url: string;
  readonly altText: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

export interface ShopifySelectedOption {
  readonly name: string;
  readonly value: string;
}

export interface ShopifyVariant {
  readonly id: string;
  readonly title: string;
  readonly availableForSale: boolean;
  readonly quantityAvailable: number | null;
  readonly selectedOptions: readonly ShopifySelectedOption[];
  readonly price: Money;
  readonly compareAtPrice: Money | null;
  readonly image: ShopifyImage | null;
}

export interface ShopifyProduct {
  readonly id: string;
  readonly handle: string;
  readonly title: string;
  readonly vendor: string;
  /** Null means the merchant copy has not been approved for TrueTone. */
  readonly description: string | null;
  readonly featuredImage: ShopifyImage | null;
  readonly variants: readonly ShopifyVariant[];
}

export interface ShopifyCartLine {
  readonly id: string;
  readonly quantity: number;
  readonly merchandise: ShopifyVariant & { readonly product: Pick<ShopifyProduct, 'id' | 'handle' | 'title' | 'vendor'> };
}

export interface ShopifyCart {
  readonly id: string;
  /** Includes Shopify's consent payload. It must be passed to checkout unchanged. */
  readonly checkoutUrl: string;
  readonly totalQuantity: number;
  readonly lines: readonly ShopifyCartLine[];
  readonly subtotal: Money;
}
