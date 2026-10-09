export const STOREFRONT_FIXTURE = Object.freeze({
  products: {
    products: {
      nodes: [
        {
          id: 'gid://shopify/Product/1',
          handle: 'lip-color',
          title: 'Lip Color',
          vendor: 'Example Supplier',
          featuredImage: {
            url: 'https://cdn.shopify.com/s/files/test/lip-color.webp',
            altText: 'Lip color tube',
            width: 1200,
            height: 1200,
          },
          variants: {
            nodes: [
              {
                id: 'gid://shopify/ProductVariant/1',
                title: 'Rose',
                availableForSale: true,
                quantityAvailable: 8,
                selectedOptions: [{ name: 'Shade', value: 'Rose' }],
                price: { amount: '24.00', currencyCode: 'USD' },
                compareAtPrice: null,
                image: null,
              },
            ],
          },
        },
      ],
    },
  },
  cartCreate: {
    cartCreate: {
      cart: {
        id: 'gid://shopify/Cart/new',
        checkoutUrl: 'https://hwqi01-wd.myshopify.com/cart/c/opaque?_cs=default-deny',
        totalQuantity: 0,
        cost: { subtotalAmount: { amount: '0.00', currencyCode: 'USD' } },
        lines: { nodes: [] },
      },
      userErrors: [],
    },
  },
});
