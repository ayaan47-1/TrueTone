# Stripe Checkout Production-Verification Runbook (Gap 10)

**Status:** Production-verifiable in Stripe Test Mode with automated mock-test validation. Zero live charges, external payment network calls, or paid transactions are made.

## 1. Overview & Architecture

TrueTone's physical makeup goods checkout operates on Stripe PaymentSheet:
- **Client SDK**: `@stripe/stripe-react-native` presents the native iOS/Android PaymentSheet. No raw card numbers ever touch TrueTone servers or client logs.
- **Backend Edge Function (`create-payment-intent`)**:
  - Validates caller JWT and identity.
  - Computes order total server-side from `src/features/match/product-catalog.ts` via `computeOrderTotalCents()`. Client amounts are ignored to prevent price tampering.
  - Maps user to `stripe_customer_id` via `public.user_entitlements`.
  - Creates a Stripe `PaymentIntent` and `EphemeralKey`.
  - Records an order in `public.orders` with status `'pending'`.
- **Webhook Function (`stripe-webhook`)**:
  - Verifies `Stripe-Signature` using `STRIPE_WEBHOOK_SECRET`.
  - On `payment_intent.succeeded`: updates order status to `'paid'` using service-role privileges.
  - On `payment_intent.payment_failed`: updates order status to `'failed'`.

## 2. Test-Mode Verification Protocol (Zero Live Charges)

To verify the checkout flow safely without charging any real payment card:

### 2.1 Test Cards
Always use Stripe's official test cards in **Test Mode** (`pk_test_*`, `sk_test_*`):
- **Happy Path (Immediate Success)**: `4242 4242 4242 4242` (any future expiry, any 3-digit CVC).
  - Expected: PaymentSheet succeeds, bag clears, confirmation screen displays with order number, order in DB flips to `paid`.
- **Card Declined**: `4000 0000 0000 0002`.
  - Expected: PaymentSheet displays inline card decline, user is alerted, bag items are preserved, order flips to `failed`.
- **3D Secure Authentication Required**: `4000 0025 0000 3155`.
  - Expected: PaymentSheet opens modal 3DS challenge simulator. Tapping "Complete" approves charge.

### 2.2 Security & Anti-Tampering Proofs
1. **Payload Minimization**:
   - The app sends only `{ items: [{ product: { id: "..." }, qty: 1 }], shippingAddress: {...} }`.
   - No amount or currency is accepted from the client.
2. **Server-Side Price Integrity**:
   - Total is computed strictly by `computeOrderTotalCents()` against the trusted catalog.
   - Tampered prices or negative quantities trigger a 400 error.
3. **Webhook Cryptographic Authentication**:
   - Webhook rejects unsigned requests or invalid signatures with `400 invalid signature`.

## 3. Automated Test Evidence

Automated regression and mock verification suites in `src/features/checkout/__tests__/`:
- `pricing.test.ts` (2 tests):
  - Validates server-side catalog price computation.
  - Proves client-tampered prices (`price: 1` vs catalog `$24`) are completely ignored.
  - Proves non-existent SKUs or negative quantities throw errors.
- `CheckoutScreen.test.tsx` (5 tests):
  - Renders empty bag state.
  - Verifies happy path Stripe payment flow with shipping address form capture and order confirmation.
  - Verifies graceful handling of user cancellation (`error.code === 'Canceled'`) without error alerts.
  - Verifies inline alert on declined card while preserving bag items.
  - Verifies alert on edge function initialization failure.
- `checkout-pipeline.test.ts` (8 tests):
  - Catalog integrity and multi-item pricing.
  - Edge function customer mapping and reuse via `user_entitlements`.
  - Webhook status transitions for `payment_intent.succeeded` and `payment_intent.payment_failed`.

Total automated test suite: 15 passing tests.

## 4. Remaining Human Gates Before Live Production Transactions

1. **Stripe Production Account Activation**:
   - Complete Stripe identity verification, legal business entity details, and payout bank account.
2. **Production Key Exchange**:
   - Replace `pk_test_*` and `sk_test_*` with production `pk_live_*` and `sk_live_*` in EAS Secrets and Supabase function secrets (`STRIPE_SECRET_KEY`).
3. **Live Webhook Endpoint Configuration**:
   - In the Stripe Dashboard (Live Mode), register the webhook endpoint: `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`.
   - Select events `payment_intent.succeeded` and `payment_intent.payment_failed`.
   - Store the generated production signing secret as `STRIPE_WEBHOOK_SECRET` via `supabase secrets set`.
4. **Physical Fulfillment & Merchant Operations**:
   - Integrate order table listener or webhook to a 3PL / physical warehouse for shipping real inventory.
   - Establish refund, return, and tax calculation policies.
