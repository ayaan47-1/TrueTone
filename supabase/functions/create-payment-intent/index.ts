import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.19.0';
import { computeOrderTotalCents } from '../_shared/checkout/pricing.ts';
import { resolveStripeCustomer } from '../_shared/checkout/customer-mapping.ts';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('unauthorized', { status: 401 });

  // Client scoped to the caller's JWT -> RLS applies
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  let body: { items?: { product: { id: string; price?: number }; qty: number }[]; shippingAddress?: unknown };
  try { body = await req.json(); } catch { return new Response('bad request', { status: 400 }); }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return new Response('bad request: missing items', { status: 400 });
  }

  let serverTotalCents = 0;
  try {
    serverTotalCents = computeOrderTotalCents(body.items);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'bad request: invalid items', { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  const serviceSupabase = serviceKey
    ? createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)
    : null;

  try {
    // Determine customer and reuse from user_entitlements if already mapped. Fails closed (never
    // falls back to the RLS-scoped `supabase` client, which cannot write this table) when the
    // service role key is absent or the mapping write itself fails -- see customer-mapping.ts.
    const mapping = await resolveStripeCustomer(
      { authedSupabase: supabase, serviceSupabase, createStripeCustomer: (args) => stripe.customers.create(args) },
      user.id,
      user.email,
    );
    if (!mapping.ok) {
      console.error('Stripe customer mapping failed', mapping.message);
      return new Response(mapping.message, { status: mapping.status });
    }
    const customerId = mapping.customerId;

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: serverTotalCents,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create the order in Supabase
    const { error } = await supabase.from('orders').insert({
      user_id: user.id,
      stripe_payment_intent_id: paymentIntent.id,
      amount: serverTotalCents,
      items: body.items,
      shipping_address: body.shippingAddress ?? null,
      status: 'pending'
    });

    if (error) {
      console.error('Failed to create order', error);
      return new Response('internal error', { status: 500 });
    }

    return Response.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: Deno.env.get('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    });

  } catch (e) {
    console.error('stripe error', e);
    return new Response('payment intent failed', { status: 500 });
  }
});
