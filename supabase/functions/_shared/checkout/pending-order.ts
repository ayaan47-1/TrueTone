// Builds and inserts the 'pending' order row for create-payment-intent.
// Orders are written only server-side (migration 0025 revoked client writes): the caller passes
// a service-role client, status is always 'pending', and the amount is the server-computed total.
// Only stripe-webhook (signature-verified) moves a row to 'succeeded' / 'failed'.

export interface PendingOrderInput {
  userId: string;
  paymentIntentId: string;
  amountCents: number;
  items: unknown;
  shippingAddress?: unknown;
}

export interface PendingOrderRow {
  user_id: string;
  stripe_payment_intent_id: string;
  amount: number;
  items: unknown;
  shipping_address: unknown;
  status: 'pending';
}

/** The minimal slice of a Supabase client this module needs (keeps it testable without Deno). */
export interface OrderInsertDb {
  from(table: 'orders'): { insert(row: PendingOrderRow): PromiseLike<{ error: unknown }> };
}

export function buildPendingOrderRow(input: PendingOrderInput): PendingOrderRow {
  if (!input.userId) throw new Error('invalid user');
  if (!input.paymentIntentId) throw new Error('invalid payment intent');
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error('invalid amount');
  return {
    user_id: input.userId,
    stripe_payment_intent_id: input.paymentIntentId,
    amount: input.amountCents,
    items: input.items,
    shipping_address: input.shippingAddress ?? null,
    status: 'pending',
  };
}

export async function insertPendingOrder(
  db: OrderInsertDb,
  input: PendingOrderInput,
): Promise<{ error: unknown }> {
  const { error } = await db.from('orders').insert(buildPendingOrderRow(input));
  return { error };
}
