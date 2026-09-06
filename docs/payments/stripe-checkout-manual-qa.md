# Manual QA Checklist: Stripe Checkout (Physical Goods)

This checklist verifies the end-to-end integration of the Stripe PaymentSheet for physical makeup items. It ensures the flow is operational, secure against tampering, and properly integrated with Stripe webhooks.

## 1. PRECONDITIONS
Ensure the environment is fully wired and in **Stripe TEST Mode**:

- [ ] **Database Migration**: Confirm migration `0020_orders.sql` has been applied to the Supabase database.
- [ ] **Frontend Environment**: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set in the local `.env` or EAS secrets.
- [ ] **Backend Environment**: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set in the Supabase Edge Functions environment via `supabase secrets set`.
- [ ] **Native Rebuild Required**: Because `@stripe/stripe-react-native` adds native code, you MUST rebuild the dev client (`npx expo run:ios --device` or an EAS development build). A JS reload is insufficient. The Stripe config plugin must be present in `app.json` before rebuilding to ensure the URL scheme for 3DS return handling is wired.

- [ ] **Deploy Edge Functions**: Both functions are deployed to Supabase:
  - `supabase functions deploy create-payment-intent`
  - `supabase functions deploy stripe-webhook`
- [ ] **Webhook Registration**: In the Stripe Dashboard (Test Mode), a webhook endpoint is registered pointing to `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`. It should be listening for `payment_intent.succeeded` and `payment_intent.payment_failed` events.
- [ ] **Stripe Dashboard**: Ensure you are in **Test Mode** (toggle in upper right of Stripe dashboard).

## 2. HAPPY PATH (Successful Checkout)
- [ ] Start the TrueTone Expo app and log in.
- [ ] Add one or more physical makeup items to the bag from the Shop screen. Note the total price shown.
- [ ] Tap the bag to open `CheckoutScreen`.
- [ ] Tap **"Pay securely with Stripe"**. Verify the native Stripe PaymentSheet appears.
- [ ] Enter the Stripe success test card: `4242 4242 4242 4242` (any future expiry, any CVC).
- [ ] Tap **Pay**.
- [ ] **App Verification**: The PaymentSheet dismisses, the bag clears, and the app shows the "Order placed" confirmation screen with an order number.
- [ ] **Stripe Dashboard Verification**: Verify a new `PaymentIntent` was created and succeeded, matching the total price from the app.
- [ ] **Supabase Verification**: Check the `orders` table in Supabase. A new row should exist for your user ID.
  - The `stripe_payment_intent_id` matches the Stripe dashboard.
  - The `status` should quickly transition to `succeeded` (updated by the webhook).
  - The `amount` (in cents) perfectly matches the catalog prices of the items (server-computed).

## 3. FAILURE PATHS
- [ ] **Declined Card**: Go to checkout, open PaymentSheet. Enter the generic declined test card: `4000 0000 0000 0002`.
  - [ ] **Result**: PaymentSheet shows a decline/failure message directly to the user. The app does NOT proceed to the confirmation screen. The `orders` row in Supabase will eventually flip to `failed` via webhook.
- [ ] **Authentication Required (3DS)**: Open PaymentSheet, enter the 3DS test card: `4000 0025 0000 3155`.
  - [ ] **Result**: The PaymentSheet presents a 3D Secure modal challenge. Complete the mock challenge. After success, the app proceeds to confirmation, and the `orders` row updates to `succeeded`.

## 4. SECURITY / TAMPERING
- [ ] **Payload Minimization**: Inspect the network tab or app logs when tapping "Pay securely with Stripe". Confirm the payload sent to `/functions/v1/create-payment-intent` contains only `items: [{ product: { id: "..." }, qty: 1 }]` and does NOT contain an `amount` field.
- [ ] **Price Tampering Resistance**: Use a REST client (like Postman or cURL) to make an authenticated POST request to `create-payment-intent` using a valid user JWT. Manually add an `amount: 100` field or mutate the item prices to `price: 1`.
  - [ ] **Result**: Check the Stripe dashboard for the generated `PaymentIntent`. Verify the amount charged is the **true catalog total**, proving the server completely ignored the spoofed price.
- [ ] **Invalid Product ID**: In the REST client, send a request with a fake product ID (e.g., `{ product: { id: "fake-product" }, qty: 1 }`).
  - [ ] **Result**: The server returns a `400 Bad Request` ("bad request: product fake-product not found") and no PaymentIntent is created.
- [ ] **Unauthenticated Access**: Make a POST request to `create-payment-intent` with no `Authorization` header.
  - [ ] **Result**: The server returns a `401 Unauthorized`.
- [ ] **Webhook Signature Verification**: Make a POST request to `stripe-webhook` with a fake or missing `Stripe-Signature` header.
  - [ ] **Result**: The server returns a `400 Bad Request` ("no signature" or "invalid signature"), proving unauthorized systems cannot mark orders as paid.

## 5. CLEANUP / NOTES
- No raw credit card data should ever be logged in the Expo app terminal, Supabase edge function logs, or saved in the `orders` table. Only Stripe tokens/Intents cross our servers.
- When reviewing test webhooks in the Stripe dashboard, check the "Events" tab. You can click into an event to verify the exact payload Stripe delivered to your webhook endpoint and the `200 OK` response from Supabase.
