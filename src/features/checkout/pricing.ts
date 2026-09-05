import { catalog } from '../match/product-catalog';

export interface CheckoutLineItem {
  product: { id: string; price?: number };
  qty: number;
}

export function computeOrderTotalCents(items: CheckoutLineItem[]): number {
  let serverTotalCents = 0;
  for (const line of items) {
    if (!line.product || !line.product.id || typeof line.qty !== 'number' || line.qty <= 0) {
      throw new Error('invalid item');
    }
    const catalogItem = catalog.find((c) => c.id === line.product.id);
    if (!catalogItem) {
      throw new Error(`product ${line.product.id} not found`);
    }
    // Ignore any price sent by the client, use catalogItem.price
    serverTotalCents += Math.round(catalogItem.price * 100) * line.qty;
  }
  
  if (serverTotalCents <= 0) {
    throw new Error('total must be greater than 0');
  }
  return serverTotalCents;
}
