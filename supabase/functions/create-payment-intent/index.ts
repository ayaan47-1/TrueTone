import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.19.0';
import { computeOrderTotalCents } from '../_shared/checkout/pricing.ts';
import { insertPendingOrder } from '../_shared/checkout/pending-order.ts';
import { checkoutRequestSchema } from '../_shared/checkout/shipping-address.ts';

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

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { return new Response('bad request', { status: 400 }); }
  const parsedBody = checkoutRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) return new Response('bad request: invalid checkout', { status: 400 });
  const body = parsedBody.data;

  let serverTotalCents = 0;
  try {
    serverTotalCents = computeOrderTotalCents(body.items);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'bad request: invalid items', { status: 400 });
  }

  // Orders are written only server-side: clients have no write access to orders (migration 0025).
  // Check the service-role key before touching Stripe so a misconfig leaves no orphaned PaymentIntent.
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) {
    console.error('create-payment-intent: SUPABASE_SERVICE_ROLE_KEY is not set');
    return new Response('internal error', { status: 500 });
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    // Determine customer
    let customerId: string | undefined = undefined;
    const { data: customerData } = await supabase.from('user_entitlements').select('stripe_customer_id').eq('id', user.id).maybeSingle();
    if (customerData?.stripe_customer_id) {
        customerId = customerData.stripe_customer_id;
    } else {
        const customer = await stripe.customers.create({ email: user.email });
        customerId = customer.id;
    }

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

    // Create the order server-side with the service-role client (see above); status is forced
    // to 'pending' and the amount is the server-computed total. Only stripe-webhook sets paid status.
    const { error } = await insertPendingOrder(admin, {
      userId: user.id,
      paymentIntentId: paymentIntent.id,
      amountCents: serverTotalCents,
      items: body.items,
      shippingAddress: body.shippingAddress,
    });

    if (error) {
        // Do not attach the database error: constraint details can echo the PII-bearing row.
        console.error('Failed to create pending order');
        return new Response('internal error', { status: 500 });
    }

    return Response.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: Deno.env.get('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY') // Optional, frontend can have it via env var directly
    });

  } catch (e) {
    console.error('stripe error', e);
    return new Response('payment intent failed', { status: 500 });
  }
});
