# Live shade catalogue

Shopify supplies commerce data. Supabase holds product evidence, label revisions, stock snapshots, and sync bookkeeping. No shopper or biometric data enters this subsystem. The functions issue read-only Shopify GraphQL requests; this change registers no live webhooks and applies no hosted migrations.

## Verify locally

Use Node 22.18 or later and the existing npm dependencies. The Node tests import TypeScript directly and run separately from Expo's compiler and Jest.

```sh
node --experimental-strip-types --test test/catalog/*.test.mjs
npx tsc --noEmit
npx tsc --ignoreConfig --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --skipLibCheck supabase/functions/_shared/catalog/*.ts supabase/functions/shopify-catalog-webhook/index.ts supabase/functions/catalog-reconcile/index.ts src/features/catalog/fallback.ts
npm run check:compliance
npm run check:no-egress
```

In an isolated local Supabase development stack, apply the migrations and run pgTAP:

The catalogue migrations are `0034_live_catalog.sql`, `0035_catalog_sync.sql`, and `0036_catalog_reconcile_schedule.sql`, after main's audit-execute and shade-history migrations.

```sh
supabase db reset --local
supabase test db --local
```

The reset deletes local development data. Never substitute a hosted database URL. New pgTAP suites exercise label constraints, role grants, recommendation filters, event retries, product versioning, and sync ordering.

## Configure after deployment approval

The operator configures these server-side variables, never Expo public variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Service-only persistence RPCs |
| `SHOPIFY_STORE_DOMAIN` | Exact allowed `*.myshopify.com` shop |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Read products, publication, inventory, and locations |
| `SHOPIFY_PUBLICATION_ID` | Publication used for app purchase eligibility |
| `SHOPIFY_ONLINE_LOCATION_IDS` | JSON array of eligible location GIDs |
| `SHOPIFY_CATALOG_WEBHOOK_SECRET` | Shopify app webhook signing secret |
| `CATALOG_RECONCILE_SECRET` | Independent random bearer token for the nightly worker |

Use the Shopify app's required read scopes, including `read_products`, `read_inventory`, `read_locations`, and publication access. Confirm grants against the deployed API version, pinned here to `2026-10`. No write scopes are needed by this implementation.

After approval, subscribe `shopify-catalog-webhook` to `products/create`, `products/update`, `products/delete`, and best-effort `inventory_levels/update`. JWT validation is disabled only on these two functions because they verify Shopify HMAC or a dedicated reconcile bearer token. Other functions keep their existing authentication.

The migration schedules `truetone-catalog-reconcile` at 04:00 UTC daily. The operator installs two Vault secrets: `catalog_reconcile_url`, the HTTPS `/functions/v1/catalog-reconcile` endpoint, and `catalog_reconcile_token`, equal to the worker's bearer token. Until configured, cron records `blocked/configuration_missing` and makes no request. No secret values belong in migrations or this document.

`catalog_sync_runs` records successful, failed, and blocked runs. Alert if there is no complete run in 26 hours, a running row exceeds the function's runtime limit, or failed webhook attempts grow. Recommendation queries exclude commerce or stock observations older than 26 hours. This is an operational freshness limit, not a guarantee of immediate stock accuracy; Shopify rechecks checkout availability.

## Label a shade

Use a restricted server-side admin workflow with the service role. Mobile authenticated clients can read only `catalog_recommendable`; they cannot read audit history, the needs-label queue, or call sync RPCs. There are no anonymous catalogue grants.

New variants create `unverified` labels. Approval requires depth and base undertone with M/B/C evidence, source/audit fields, and identified reviewers. C evidence requires two reviewers. Independent modifiers carry their own tier map. A rank is ordinal within its formula only. Instrument Lab requires the complete applied-product protocol; M-labelled results are excluded until `lab_validated` is true. B/C rows remain coarse catalogue suggestions.

Approved evidence is immutable. Create a new revision and explicitly update its binding rather than edit approved coordinates. Changes to the exact formula version or shade identity queue a fresh unverified revision. `truetone.formula_version` is an operator-maintained Shopify metafield; without it the version is `unversioned`. A feed cannot detect an undisclosed reformulation, so the operator must update that metadata when a formula changes. A stable formula key is normalized vendor plus product title; name changes conservatively require review.

Deleted/re-imported variants retain history. Unique vendor plus SKU/barcode matches, or weaker formula/shade identities, offer `candidate_label_id` for review. Nothing reattaches approved evidence automatically. The admin must confirm formula/version and create or bind the reviewed revision. Conflicting candidates remain unverified.

## Matching and limits

`chooseAvailableShades` is a pure on-device stock fallback. It preserves the unavailable best shade ID for explanation, then ranks suitable verified in-stock same-formula options ahead of cross-brand options. It checks depth-band proximity and known base undertone, finish, coverage, currency, and budget. The caller supplies validated suitability limits and explicit preferences. It never treats a within-formula rank as a cross-brand colour distance, forces an option, or emits an exact-match claim.

The app reads `catalog_recommendable` through an authenticated, paginated projection. It refreshes on foregrounding and once per minute while mounted; failures and empty results show an explicit retry state, never synthetic products. Synthetic products remain only in the explicit demo build and test fixtures. Camera-offline builds make no catalogue or Shopify requests.

Home and product detail use actual variant IDs, prices and reviewed evidence. The current UI supports USD only; other currencies are rejected rather than mislabelled. Missing finish, images and swatches are shown as unavailable, not invented. An unavailable previously viewed shade can offer alternatives after the shopper confirms the displayed finish, coverage and budget criteria; matching stays in the same depth band and uses the shared same-formula-first ranking.

After the existing Shopify privacy notice is accepted, Storefront reads join only currently approved variant IDs. Persistent commerce caches are disabled because they cannot establish current approval. Adding a shade rechecks the view and sends only its variant ID and quantity to Shopify. No skin, scan or recommendation context is sent. Shopify still verifies final price and inventory at checkout.

Admin UI and the shade-engine branch's measured-colour adapter still need integration and validation. No Match My Foundation data or feedback logging is loaded. Those require their separate approved steps.

Full reconciliation traverses all product, variant, and inventory pages before marking anything missing. A page or API failure leaves existing rows intact and records failure. Retry on the next scheduled or operator-triggered run. Large catalogues may exceed the Edge Function runtime; measure the actual product count and run time before enabling production, then add durable chunked continuation if needed. Shopify throttling fails the run safely rather than hiding partial results as a successful reconcile.
