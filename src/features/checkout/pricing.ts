import { catalog } from '../match/product-catalog';

export interface CheckoutLineItem {
  product: { id: string; price?: number };
  qty: number;
}

export function computeOrderTotalCents(items: readonly CheckoutLineItem[]): number {
  let totalCents = 0;
  for (const line of items) {
    if (!line.product || !line.product.id || typeof line.qty !== 'number' || line.qty <= 0) {
      throw new Error('invalid item');
    }
    const catalogItem = catalog.find((c) => c.id === line.product.id);
    if (!catalogItem) {
      throw new Error(`product ${line.product.id} not found`);
    }
    // Ignore any price sent by the client, use catalogItem.price
    totalCents += Math.round(catalogItem.price * 100) * line.qty;
  }
  
  if (totalCents <= 0) {
    throw new Error('total must be greater than 0');
  }
  return totalCents;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
