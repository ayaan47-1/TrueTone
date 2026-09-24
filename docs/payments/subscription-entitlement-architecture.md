# TrueTone Plus Subscription & Entitlement Architecture (Gap 3)

**Status:** Integration-ready architecture and deterministic mock-validated implementation. No live App Store/Play Store charges or paid vendor accounts are active in this workspace.

## 1. Overview & Business Model

"TrueTone Plus" provides recurring subscription access to premium features:
- **Unlimited scans & routine guidance**: Unlocked in-app cosmetic personalization.
- **Skin appearance age & trends**: Unlocked display via `hasAgeAccess()`.
- **Pricing Tiers**:
  - Yearly: `$39.99/year` with a 7-day free trial (Best Value).
  - Monthly: `$8.99/month` recurring.

## 2. Platform Compliance & Privacy Boundary

1. **Apple App Store Guideline 3.1.1 (In-App Purchase)**:
   - Digital features (such as TrueTone Plus unlimited scans and skin age trends) must use Apple In-App Purchase / StoreKit.
   - Physical makeup goods (e.g. checkout for makeup bags) remain on Stripe PaymentSheet.
2. **Biometric Privacy Isolation**:
   - The entitlement and subscription subsystem strictly isolates billing from biometric data.
   - `src/features/premium/` does NOT import, store, or reference face images, facial landmarks, raw skin-tone RGB/CIELAB coordinates, or health conditions.
   - Verified by automated regression guard in `src/features/premium/__tests__/entitlement.test.ts`.
3. **App Store Guideline 3.1.1 (Restore Purchases)**:
   - `PaywallScreen` provides a prominent and functional "Restore purchases" action.
   - Subscriptions include explicit disclosures (cancellation policy, auto-renewal terms).

## 3. Architecture & Pluggable Adapter Pattern

The entitlement layer uses the dependency inversion pattern via `EntitlementSource`:

```
+-------------------------------------------------------------+
|                     UI Layer                                |
|   PaywallScreen (app/paywall.tsx)                           |
|   AgeTrendCard (src/features/age/AgeTrendCard.tsx)          |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                Entitlement Service Seam                     |
|           (src/features/premium/entitlement.ts)             |
|   hasPlusAccess(), hasAgeAccess(), purchasePlan(), etc.     |
+-------------------------------------------------------------+
                              |
              +---------------+---------------+
              |                               |
              v                               v
+---------------------------+   +-----------------------------+
|   localStubEntitlement    |   |    createRevenueCatAdapter  |
|  (offline dev / testing)  |   |    (StoreKit / RevenueCat)  |
+---------------------------+   +-----------------------------+
```

### Methods on `EntitlementSource`:
- `hasPlusAccess(): boolean`: Returns whether TrueTone Plus is currently active.
- `hasAgeAccess(): boolean`: Returns whether skin age trends are visible (retains backwards compatibility).
- `getEntitlement(): Promise<EntitlementInfo>`: Returns structured status (`active`, `trial`, `past_due`, `none`).
- `purchase(plan: SubscriptionPlan): Promise<PurchaseResult>`: Initiates purchase.
- `restorePurchases(): Promise<PurchaseResult>`: Restores existing transactions.
- `subscribe(listener)`: Event stream for real-time entitlement state changes.

## 4. Backend Database Schema (`0022_user_entitlements.sql`)

- Table `public.user_entitlements`:
  - `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
  - `is_plus_subscriber boolean NOT NULL DEFAULT false`
  - `subscription_tier text CHECK (subscription_tier IN ('yearly', 'monthly', 'trial', 'none'))`
  - `subscription_status text CHECK (subscription_status IN ('active', 'trial', 'past_due', 'canceled', 'expired', 'none'))`
  - `stripe_customer_id text UNIQUE` (used by checkout edge function)
  - `expires_at timestamptz`
- RLS enabled: authenticated users can only SELECT their own entitlement (`auth.uid() = id`).
- Service role possesses write access for webhook synchronization.

## 5. Verification & Testing

- `src/features/premium/__tests__/entitlement.test.ts` (9 tests passing):
  - Locked default state.
  - Source injection and dynamic reflection.
  - Yearly and monthly purchase lifecycle.
  - Trial flag handling.
  - Restore purchases workflow.
  - Multi-subscriber notifications.
  - Unconfigured adapter fail-closed safety.
  - Static compliance isolation check against biometric/health modules.
- `app/__tests__/paywall-route.test.tsx` (3 tests passing):
  - Plan pricing and trial CTA rendering.
  - Purchase subscription and scan-gate navigation.
  - "Maybe later" free-tier navigation.
- `supabase/tests/user_entitlements.test.sql` (7 tests):
  - Schema, columns, service-role write, and RLS tenant isolation.

## 6. Remaining Human Gates for Production Enablement

1. **App Store Connect Setup**:
   - Register App Store Subscription Group `TrueTone Plus`.
   - Create In-App Purchase products: `com.truetone.plus.yearly` and `com.truetone.plus.monthly`.
   - Configure 7-day introductory trial on the yearly product.
2. **RevenueCat / StoreKit Credentials**:
   - Create RevenueCat project and link Apple In-App Purchase Shared Secret / App Store Server API key.
   - Provide public SDK key (`EXPO_PUBLIC_REVENUECAT_APPLE_KEY`) via EAS secrets or runtime config.
3. **Legal Review**:
   - Confirm Terms of Use (EULA) and Subscription Terms URL linked in App Store metadata.
