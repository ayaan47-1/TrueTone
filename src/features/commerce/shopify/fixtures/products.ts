export const PRODUCT_FIXTURE_NODE = {
  id: 'gid://shopify/Product/1',
  handle: 'yensa-bronzing-drops',
  title: 'YENSA Bronzing Drops',
  vendor: 'YENSA',
  description: '',
  featuredImage: {
    url: 'https://cdn.shopify.com/s/files/test/yensa.png',
    altText: 'YENSA Bronzing Drops bottle',
    width: 1200,
    height: 1200,
  },
  variants: {
    nodes: [
      {
        id: 'gid://shopify/ProductVariant/1',
        title: 'Unavailable',
        availableForSale: false,
        quantityAvailable: 0,
        selectedOptions: [{ name: 'Shade', value: 'Unavailable' }],
        price: { amount: '24.00', currencyCode: 'USD' },
        compareAtPrice: null,
        image: null,
      },
      {
        id: 'gid://shopify/ProductVariant/2',
        title: 'Universal',
        availableForSale: true,
        quantityAvailable: 8,
        selectedOptions: [{ name: 'Shade', value: 'Universal' }],
        price: { amount: '24.00', currencyCode: 'USD' },
        compareAtPrice: null,
        image: null,
      },
    ],
  },
} as const;
