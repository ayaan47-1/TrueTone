# TrueTone Payments & Stripe Checkout Plan

## (a) Current State
- **Paywall UI**: `app/paywall.tsx` exists as a pricing shell with monthly/yearly options, but it acts solely as a pre-scan cosmetic screen that routes to `/scan-gate`. No payment backend is wired.
- **Checkout Shell**: `src/features/checkout/CheckoutScreen.tsx` is an explicitly labelled "demo" shell. It computes a subtotal from `bag-store`, shows an address form, and a disabled mock "demo card" section. "Place order" clears the bag and shows a mock confirmation. It does not load or process real payment methods.
- **Configuration**: There are no Stripe-specific configurations in `app.json` or `app.config.ts`, nor are there any Stripe edge functions in `supabase/functions/`.

## (b) The Gap
To make payments real, we are missing:
- **Client Side**: Integration of the Stripe React Native SDK (`@stripe/stripe-react-native`) to render the native PaymentSheet. The mock `PaymentDemo` component needs to be replaced with the actual Stripe flow, which requires fetching a `PaymentIntent` client secret from the backend.
- **Server Side**: A Supabase Edge Function to create Stripe `PaymentIntent` (or `SetupIntent` for subscriptions) and generate the client secret securely.
- **Webhooks**: A separate Supabase Edge Function to securely receive Stripe webhooks (e.g., `payment_intent.succeeded`, `customer.subscription.updated`) to fulfill the order and update the user's entitlements in our database.
- **Database/Entitlements**: Supabase tables and RLS policies for tracking user subscription state/entitlements and order history.

## (c) Proposed Flow & Privacy Isolation
**Privacy Constraints:** No raw card data must ever touch the Expo app or Supabase servers.

1. **Initiation**: When the user taps "Place order" (or "Subscribe"), the app calls a Supabase Edge Function (`create-payment-intent`) over HTTPS, passing the user ID and cart items (or plan choice). No biometric or skin data is sent.
2. **Stripe Backend**: The Edge Function talks server-to-server with Stripe to create a Customer (if needed) and a PaymentIntent/Subscription, returning the `client_secret` to the app.
3. **PaymentSheet**: The app uses `@stripe/stripe-react-native` to present the native PaymentSheet. The user enters card details directly into Stripe's secure UI.
4. **Fulfillment (Webhook)**: Upon successful payment, Stripe fires a webhook to a second Supabase Edge Function (`stripe-webhook`). The function validates the signature and updates the user's entitlement record in the DB.
5. **App Store IAP Implications**: Because we are offering a digital subscription (TrueTone Plus) and potentially digital goods, **Apple App Store Review Guidelines may require us to use Apple's In-App Purchase (IAP)**. If TrueTone Plus unlocks in-app features (like unlimited scans), Apple prohibits using Stripe for it. We must clarify if these are physical goods (makeup = Stripe allowed) or digital goods (Plus subscription = IAP required).

## (d) Secrets & Config Needed from Human
Do not commit these values. Human must provide:
- **Expo / App Env**:
  - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Supabase Edge Functions Env**:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`

## (e) Phased Build Plan & Open Questions
**Open Questions for Sign-Off:**
1. **IAP vs Stripe**: Does "TrueTone Plus" unlock digital features (requires Apple IAP/RevenueCat) or physical goods? If digital, we cannot use Stripe for the subscription on iOS.
2. **Product Catalog**: Are the makeup items in the bag physical goods shipped to the user? If so, Stripe is correct for the physical checkout.

**Phased Build Plan (<= 5 files per phase):**
- **Phase 1: DB & Edge Function Skeleton**: 
  - Migration for `user_entitlements` / `orders` tables.
  - Create `create-payment-intent` edge function.
- **Phase 2: Stripe Webhook**:
  - Create `stripe-webhook` edge function.
  - Implement signature verification and DB fulfillment logic.
- **Phase 3: App PaymentSheet Wiring**:
  - Install `@stripe/stripe-react-native`.
  - Update `CheckoutScreen.tsx` to call the edge function and present the `PaymentSheet`.
- **Phase 4: Paywall Subscription (If Stripe is allowed)**:
  - Wire `paywall.tsx` to handle subscription intents.
