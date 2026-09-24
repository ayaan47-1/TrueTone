// src/features/checkout/__tests__/checkout-pipeline.test.ts
// Deterministic verification of the Stripe checkout, payment intent, and webhook pipeline.
// No live card charges, secret leaks, or external API calls are made.

import { computeOrderTotalCents } from '../pricing';
import { catalog } from '../../match/product-catalog';
import { resolveStripeCustomer } from '../customer-mapping';
import { applyStripeWebhookEvent } from '../webhook-order-update';

describe('Stripe Checkout & PaymentIntent Pipeline Verification', () => {
  describe('Server-Side Pricing & Anti-Tampering Engine', () => {
    it('accurately computes total in cents across multiple valid catalog items', () => {
      const items = [
        { product: { id: catalog[0].id, price: 999 }, qty: 2 },
        { product: { id: catalog[1].id, price: 0 }, qty: 1 },
      ];
      const expectedCents =
        Math.round(catalog[0].price * 100) * 2 + Math.round(catalog[1].price * 100) * 1;
      expect(computeOrderTotalCents(items)).toBe(expectedCents);
    });

    it('completely ignores client-supplied tampered amounts', () => {
      const tampered = [
        { product: { id: catalog[0].id, price: 0.01 }, qty: 1 },
      ];
      const actualCents = Math.round(catalog[0].price * 100);
      expect(computeOrderTotalCents(tampered)).toBe(actualCents);
    });

    it('rejects nonexistent product IDs with 400-level error', () => {
      expect(() =>
        computeOrderTotalCents([{ product: { id: 'unknown-sku-999' }, qty: 1 }])
      ).toThrow(/not found/);
    });

    it('rejects non-positive, zero, or fractional quantities', () => {
      expect(() =>
        computeOrderTotalCents([{ product: { id: catalog[0].id }, qty: 0 }])
      ).toThrow();
      expect(() =>
        computeOrderTotalCents([{ product: { id: catalog[0].id }, qty: -2 }])
      ).toThrow();
      expect(() =>
        computeOrderTotalCents([{ product: { id: catalog[0].id }, qty: 1.5 }])
      ).toThrow();
    });
  });

  describe('Edge Function create-payment-intent: resolveStripeCustomer (real extracted handler)', () => {
    function authedSupabaseReturning(stripe_customer_id: string | null) {
      return {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: stripe_customer_id ? { stripe_customer_id } : null }),
            }),
          }),
        }),
      };
    }

    it('reuses an existing mapped Stripe customer without calling Stripe or the service client', async () => {
      const authedSupabase = authedSupabaseReturning('cus_existing_456');
      const serviceSupabase = { from: jest.fn() };
      const createStripeCustomer = jest.fn();

      const result = await resolveStripeCustomer(
        { authedSupabase, serviceSupabase, createStripeCustomer },
        'usr_test_123',
        'test@example.com',
      );

      expect(result).toEqual({ ok: true, customerId: 'cus_existing_456' });
      expect(createStripeCustomer).not.toHaveBeenCalled();
      expect(serviceSupabase.from).not.toHaveBeenCalled();
    });

    it('creates and persists a new Stripe customer mapping when none exists', async () => {
      const authedSupabase = authedSupabaseReturning(null);
      const upsert = jest.fn().mockResolvedValue({ error: null });
      const serviceSupabase = { from: jest.fn().mockReturnValue({ upsert }) };
      const createStripeCustomer = jest.fn().mockResolvedValue({ id: 'cus_created_111' });

      const result = await resolveStripeCustomer(
        { authedSupabase, serviceSupabase, createStripeCustomer },
        'usr_new_999',
        'new@example.com',
      );

      expect(result).toEqual({ ok: true, customerId: 'cus_created_111' });
      expect(createStripeCustomer).toHaveBeenCalledWith({ email: 'new@example.com' });
      expect(upsert).toHaveBeenCalledWith({ id: 'usr_new_999', stripe_customer_id: 'cus_created_111' });
    });

    it('fails closed when no service-role client is configured, without creating a Stripe customer', async () => {
      const authedSupabase = authedSupabaseReturning(null);
      const createStripeCustomer = jest.fn();

      const result = await resolveStripeCustomer(
        { authedSupabase, serviceSupabase: null, createStripeCustomer },
        'usr_unconfigured',
        'nobody@example.com',
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(500);
      expect(createStripeCustomer).not.toHaveBeenCalled();
    });

    it('fails closed when the customer-map upsert errors', async () => {
      const authedSupabase = authedSupabaseReturning(null);
      const upsert = jest.fn().mockResolvedValue({ error: { message: 'constraint violation' } });
      const serviceSupabase = { from: jest.fn().mockReturnValue({ upsert }) };
      const createStripeCustomer = jest.fn().mockResolvedValue({ id: 'cus_orphaned_222' });

      const result = await resolveStripeCustomer(
        { authedSupabase, serviceSupabase, createStripeCustomer },
        'usr_upsert_fails',
        'fails@example.com',
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(500);
    });
  });

  describe('Stripe Webhook Order Settlement: applyStripeWebhookEvent (real extracted handler)', () => {
    function supabaseUpdating(error: { message: string } | null) {
      const eq = jest.fn().mockResolvedValue({ error });
      const update = jest.fn().mockReturnValue({ eq });
      return { supabase: { from: jest.fn().mockReturnValue({ update }) }, update, eq };
    }

    it('flips order status to paid upon payment_intent.succeeded', async () => {
      const { supabase, update, eq } = supabaseUpdating(null);

      const result = await applyStripeWebhookEvent(supabase, {
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_success_123' } },
      });

      expect(result).toEqual({ ok: true, handled: true });
      expect(update).toHaveBeenCalledWith({ status: 'paid' });
      expect(eq).toHaveBeenCalledWith('stripe_payment_intent_id', 'pi_success_123');
    });

    it('flips order status to failed upon payment_intent.payment_failed', async () => {
      const { supabase, update } = supabaseUpdating(null);

      const result = await applyStripeWebhookEvent(supabase, {
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_failed_456' } },
      });

      expect(result).toEqual({ ok: true, handled: true });
      expect(update).toHaveBeenCalledWith({ status: 'failed' });
    });

    it('reports handled:false for an unrecognized event type without writing to the DB', async () => {
      const { supabase, update } = supabaseUpdating(null);

      const result = await applyStripeWebhookEvent(supabase, {
        type: 'customer.created',
        data: { object: { id: 'irrelevant' } },
      });

      expect(result).toEqual({ ok: true, handled: false });
      expect(update).not.toHaveBeenCalled();
    });

    it('returns ok:false (retryable) when the order-status DB write fails', async () => {
      const { supabase } = supabaseUpdating({ message: 'connection reset' });

      const result = await applyStripeWebhookEvent(supabase, {
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_db_down' } },
      });

      expect(result).toEqual({ ok: false, handled: true });
    });
  });
});
