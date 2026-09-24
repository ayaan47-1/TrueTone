// supabase/functions/_shared/checkout/webhook-order-update.ts
// Mirrored copy of src/features/checkout/webhook-order-update.ts (Deno-importable; Jest imports
// the sibling copy directly since it cannot resolve `.ts`-suffixed relative imports from
// Deno-style edge functions). Keep both copies in sync -- same convention as pricing.ts.

export interface OrdersUpdateResult {
  error: { message: string } | null;
}

export interface WebhookSupabaseLike {
  from(table: string): {
    update(fields: { status: string }): {
      eq(column: string, value: string): Promise<OrdersUpdateResult>;
    };
  };
}

export interface StripeWebhookEventLike {
  type: string;
  data: { object: { id: string } };
}

export interface WebhookHandleResult {
  /** false means the order-status write failed and Stripe should retry the delivery. */
  ok: boolean;
  handled: boolean;
}

/**
 * Applies a Stripe webhook event's order-status effect. Returns `ok: false` on a DB write
 * failure so the caller can respond with a retryable (5xx) status instead of the 200 Stripe
 * would otherwise treat as "delivered, don't retry" -- a transient DB failure must not
 * permanently strand an order at `pending`.
 */
export async function applyStripeWebhookEvent(
  supabase: WebhookSupabaseLike,
  event: StripeWebhookEventLike,
): Promise<WebhookHandleResult> {
  let status: 'paid' | 'failed' | null = null;
  if (event.type === 'payment_intent.succeeded') status = 'paid';
  else if (event.type === 'payment_intent.payment_failed') status = 'failed';

  if (!status) {
    return { ok: true, handled: false };
  }

  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('stripe_payment_intent_id', event.data.object.id);

  if (error) {
    return { ok: false, handled: true };
  }
  return { ok: true, handled: true };
}
