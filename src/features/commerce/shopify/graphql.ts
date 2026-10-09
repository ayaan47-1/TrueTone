const VISITOR_CONSENT =
  '@inContext(visitorConsent: { analytics: false, preferences: false, marketing: false, saleOfData: false })';

export const PRODUCT_FIELDS = `
  id handle title vendor
  featuredImage { url altText width height }
  variants(first: 100) {
    nodes {
      id title availableForSale quantityAvailable selectedOptions { name value }
      price { amount currencyCode }
      compareAtPrice { amount currencyCode }
      image { url altText width height }
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
          image { url altText width height }
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
