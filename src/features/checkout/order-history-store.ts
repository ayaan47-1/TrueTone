// src/features/checkout/order-history-store.ts
// On-device record of products the user has bought through checkout, so the routine editor
// can suggest them. In-memory for the session, like the bag and the saved shelf: nothing is
// persisted and nothing leaves the device. Holds catalog product ids only -- no payment data.

export interface OrderHistory {
  /** Purchased product ids, most recent first, de-duplicated. */
  purchasedIds(): readonly string[];
  /** Record one placed order's product ids. */
  record(productIds: readonly string[]): void;
  clear(): void;
}

export function createOrderHistory(): OrderHistory {
  let ids: readonly string[] = [];
  return {
    purchasedIds: () => [...ids],
    record: (productIds) => {
      const fresh = [...new Set(productIds)];
      ids = [...fresh, ...ids.filter((id) => !fresh.includes(id))];
    },
    clear: () => {
      ids = [];
    },
  };
}

export const orderHistory = createOrderHistory();
