export const SHOPIFY_API_VERSION = '2026-10';
export const CART_ID_KEY = 'truetone.shopify.cart.id.v1';

const VISITOR_CONSENT =
  '@inContext(visitorConsent: { analytics: false, preferences: false, marketing: false, saleOfData: false })';

const OPTIONAL_ACCESS_DENIED_FIELDS = new Set(['quantityAvailable']);

const PRODUCT_FIELDS = `
  id handle title vendor
  featuredImage { url width height }
  variants(first: 100) {
    nodes {
      id title availableForSale quantityAvailable selectedOptions { name value }
      price { amount currencyCode }
      compareAtPrice { amount currencyCode }
      image { url width height }
    }
  }
`;

export const PRODUCTS_QUERY = `
  query Products($first: Int!) ${VISITOR_CONSENT} {
    products(first: $first, sortKey: TITLE) { nodes { ${PRODUCT_FIELDS} } }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) ${VISITOR_CONSENT} {
    product(handle: $handle) { ${PRODUCT_FIELDS} }
  }
`;

const CART_FIELDS = `
  id checkoutUrl totalQuantity
  cost { subtotalAmount { amount currencyCode } }
  lines(first: 100) {
    nodes {
      id quantity
      merchandise {
        ... on ProductVariant {
          id title availableForSale quantityAvailable selectedOptions { name value }
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          image { url width height }
          product { id handle title vendor }
        }
      }
    }
  }
`;

export const CART_QUERY = `
  query Cart($id: ID!) ${VISITOR_CONSENT} { cart(id: $id) { ${CART_FIELDS} } }
`;

export const CART_CREATE = `
  mutation CartCreate($lines: [CartLineInput!]) ${VISITOR_CONSENT} {
    cartCreate(input: { lines: $lines }) { cart { ${CART_FIELDS} } userErrors { field message } }
  }
`;

export const CART_LINES_ADD = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) ${VISITOR_CONSENT} {
    cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { field message } }
  }
`;

export const CART_LINES_UPDATE = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) ${VISITOR_CONSENT} {
    cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { field message } }
  }
`;

export const CART_LINES_REMOVE = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) ${VISITOR_CONSENT} {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART_FIELDS} } userErrors { field message } }
  }
`;

export class ShopifyRequestError extends Error {
  constructor(message = 'Shopify Storefront request failed', kind = 'invalid-response', status) {
    super(message);
    this.name = 'ShopifyRequestError';
    this.kind = kind;
    this.status = status;
  }
}

function isOptionalFieldAccessDenied(error) {
  return error?.extensions?.code === 'ACCESS_DENIED'
    && Array.isArray(error.path)
    && OPTIONAL_ACCESS_DENIED_FIELDS.has(error.path.at(-1));
}

function validHostname(host) {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(host);
}

export function readShopifyConfig(value = globalThis.TRUETONE_CONFIG?.shopify) {
  const storeDomain = value?.storeDomain?.trim().toLowerCase();
  const storefrontToken = value?.storefrontToken?.trim();
  const checkoutHosts = [...new Set((value?.checkoutHosts ?? []).map((host) => host.trim().toLowerCase()))];
  if (!storeDomain || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(storeDomain)) {
    throw new Error('Shopify store domain must be a valid myshopify.com hostname');
  }
  if (!storefrontToken) throw new Error('Missing Shopify Storefront access token');
  if (!checkoutHosts.length || checkoutHosts.some((host) => !validHostname(host)) || !checkoutHosts.includes(storeDomain)) {
    throw new Error('Shopify checkout hosts must be valid hostnames and include the store domain');
  }
  return {
    endpoint: `https://${storeDomain}/api/${SHOPIFY_API_VERSION}/graphql.json`,
    storeDomain,
    storefrontToken,
    checkoutHosts,
  };
}

export function createStorefrontClient(value, fetchImpl = fetch) {
  const config = readShopifyConfig(value);
  return {
    config,
    async request(query, variables = {}) {
      let response;
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
      let envelope;
      try {
        envelope = await response.json();
      } catch {
        throw new ShopifyRequestError('Shopify returned an invalid response', 'invalid-response');
      }
      if (envelope?.errors?.length && (
        !envelope.data || envelope.errors.some((error) => !isOptionalFieldAccessDenied(error))
      )) {
        throw new ShopifyRequestError(envelope.errors[0]?.message || undefined, 'graphql');
      }
      if (!envelope?.data) throw new ShopifyRequestError(undefined, 'invalid-response');
      return envelope.data;
    },
  };
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/[<>]/g, '').trim() : '';
}

export function safeShopifyImage(value) {
  if (!value?.url) return null;
  try {
    const url = new URL(value.url);
    if (url.protocol !== 'https:' || url.hostname !== 'cdn.shopify.com') return null;
    return {
      url: url.toString(),
      width: Number.isFinite(value.width) ? value.width : null,
      height: Number.isFinite(value.height) ? value.height : null,
    };
  } catch {
    return null;
  }
}

function mapVariant(node) {
  return {
    id: node.id,
    title: cleanText(node.title),
    availableForSale: Boolean(node.availableForSale),
    quantityAvailable: node.quantityAvailable ?? null,
    selectedOptions: Array.isArray(node.selectedOptions) ? node.selectedOptions.map((option) => ({
      name: cleanText(option.name),
      value: cleanText(option.value),
    })) : [],
    price: node.price,
    compareAtPrice: node.compareAtPrice ?? null,
    image: safeShopifyImage(node.image),
  };
}

export function mapProduct(node) {
  return {
    id: node.id,
    handle: node.handle,
    title: cleanText(node.title),
    vendor: cleanText(node.vendor),
    description: null,
    image: safeShopifyImage(node.featuredImage),
    variants: (node.variants?.nodes ?? []).map(mapVariant),
  };
}

function mapCart(node) {
  return {
    id: node.id,
    checkoutUrl: node.checkoutUrl,
    totalQuantity: node.totalQuantity,
    subtotal: node.cost.subtotalAmount,
    lines: (node.lines?.nodes ?? []).map((line) => ({
      id: line.id,
      quantity: line.quantity,
      merchandise: {
        ...mapVariant(line.merchandise),
        product: {
          id: line.merchandise.product.id,
          handle: line.merchandise.product.handle,
          title: cleanText(line.merchandise.product.title),
          vendor: cleanText(line.merchandise.product.vendor),
        },
      },
    })),
  };
}

function cartFromPayload(payload) {
  if (payload?.userErrors?.length || !payload?.cart) {
    throw new Error(payload?.userErrors?.[0]?.message || 'Shopify cart was not returned');
  }
  return mapCart(payload.cart);
}

export function createCartApi(client, storage = localStorage) {
  const remember = (cart) => {
    storage.setItem(CART_ID_KEY, cart.id);
    return cart;
  };
  const create = async (lines = []) => {
    const data = await client.request(CART_CREATE, { lines });
    return remember(cartFromPayload(data.cartCreate));
  };
  return {
    async load() {
      const id = storage.getItem(CART_ID_KEY);
      if (!id) return create();
      let data;
      try {
        data = await client.request(CART_QUERY, { id });
      } catch (error) {
        if (!(error instanceof ShopifyRequestError) || error.kind !== 'graphql') throw error;
        storage.removeItem(CART_ID_KEY);
        return create();
      }
      if (data.cart) return mapCart(data.cart);
      storage.removeItem(CART_ID_KEY);
      return create();
    },
    async add(merchandiseId, quantity = 1) {
      const id = storage.getItem(CART_ID_KEY);
      const lines = [{ merchandiseId, quantity }];
      if (!id) return create(lines);
      const data = await client.request(CART_LINES_ADD, { cartId: id, lines });
      return remember(cartFromPayload(data.cartLinesAdd));
    },
    async update(lineId, quantity) {
      const id = storage.getItem(CART_ID_KEY);
      if (!id) throw new Error('No Shopify cart exists');
      const data = await client.request(CART_LINES_UPDATE, { cartId: id, lines: [{ id: lineId, quantity }] });
      return remember(cartFromPayload(data.cartLinesUpdate));
    },
    async remove(lineId) {
      const id = storage.getItem(CART_ID_KEY);
      if (!id) throw new Error('No Shopify cart exists');
      const data = await client.request(CART_LINES_REMOVE, { cartId: id, lineIds: [lineId] });
      return remember(cartFromPayload(data.cartLinesRemove));
    },
  };
}

export function isAllowedCheckoutUrl(value, allowedHosts) {
  try {
    const url = new URL(value);
    const allowedPath = /^\/cart\/c\/[^/]+\/?$/.test(url.pathname) || /^\/checkouts\/[^/]+\/?$/.test(url.pathname);
    return url.protocol === 'https:' && allowedHosts.includes(url.hostname.toLowerCase()) && allowedPath;
  } catch {
    return false;
  }
}

export function formatMoney(money) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: money.currencyCode }).format(Number(money.amount));
}
