import type { ShopifyConfig } from './env';

interface FetchResponse {
  readonly ok: boolean;
  readonly status?: number;
  json(): Promise<unknown>;
}

type FetchImplementation = (
  input: string,
  init: { readonly method: string; readonly headers: Readonly<Record<string, string>>; readonly body: string },
) => Promise<FetchResponse>;

interface GraphqlEnvelope<T> {
  readonly data?: T;
  readonly errors?: readonly { readonly message?: string }[];
}

export type ShopifyRequestErrorKind = 'network' | 'http' | 'graphql' | 'invalid-response';

export class ShopifyRequestError extends Error {
  constructor(
    message = 'Shopify Storefront request failed',
    readonly kind: ShopifyRequestErrorKind = 'invalid-response',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ShopifyRequestError';
  }
}

export interface ShopifyClient {
  request<T>(query: string, variables?: Readonly<Record<string, unknown>>): Promise<T>;
}

export function createShopifyClient(
  config: ShopifyConfig,
  fetchImpl: FetchImplementation = fetch as FetchImplementation,
): ShopifyClient {
  return {
    async request<T>(query: string, variables: Readonly<Record<string, unknown>> = {}): Promise<T> {
      let response: FetchResponse;
      try {
        response = await fetchImpl(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': config.storefrontToken,
          },
          body: JSON.stringify({ query, variables }),
        });
      } catch {
        throw new ShopifyRequestError('Could not reach Shopify', 'network');
      }
      if (!response.ok) {
        throw new ShopifyRequestError(`Shopify returned HTTP ${response.status ?? 'error'}`, 'http', response.status);
      }
      const envelope = (await response.json()) as GraphqlEnvelope<T>;
      if (envelope.errors?.length) {
        throw new ShopifyRequestError(envelope.errors[0]?.message || undefined, 'graphql');
      }
      if (!envelope.data) {
        throw new ShopifyRequestError(undefined, 'invalid-response');
      }
      return envelope.data;
    },
  };
}
