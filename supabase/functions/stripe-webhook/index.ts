import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.19.0';
import { applyStripeWebhookEvent } from '../_shared/checkout/webhook-order-update.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const signature = req.headers.get('Stripe-Signature');
  if (!signature) return new Response('no signature', { status: 400 });

  const body = await req.text();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err);
    return new Response('invalid signature', { status: 400 });
  }

  // Use service role to bypass RLS since webhook comes from Stripe
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceKey!
  );

  const result = await applyStripeWebhookEvent(supabase, event as { type: string; data: { object: { id: string } } });

  if (!result.handled) {
    console.log(`Unhandled event type ${event.type}`);
  }

  if (!result.ok) {
    // Order-status write failed -- return a retryable status so Stripe redelivers instead of
    // treating this as delivered. A 200 here would silently strand the order at `pending`.
    console.error('Failed to update order status for event', event.type);
    return new Response(JSON.stringify({ received: false, error: 'order update failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
