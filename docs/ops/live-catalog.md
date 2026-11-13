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

Staff can use the Node command-line tool in [catalog-label-tool.md](catalog-label-tool.md) to list the queue, export evidence, save drafts, and approve reviewed labels. It has no browser or mobile UI. Migration `0037_catalog_label_tool.sql` adds its service-role-only atomic submission function.

Use a restricted server-side admin workflow with the service role. Mobile authenticated clients can read only `catalog_recommendable`; they cannot read audit history, the needs-label queue, or call sync RPCs. There are no anonymous catalogue grants.

New variants create `unverified` labels. Approval requires depth and base undertone with M/B/C evidence, source/audit fields, and identified reviewers. C evidence requires two reviewers. Independent modifiers carry their own tier map. A rank is ordinal within its formula only. Instrument Lab requires the complete applied-product protocol; M-labelled results are excluded until `lab_validated` is true. B/C rows remain coarse catalogue suggestions.

Approved evidence is immutable. Create a new revision and explicitly update its binding rather than edit approved coordinates. Changes to the exact formula version or shade identity queue a fresh unverified revision. `truetone.formula_version` is an operator-maintained Shopify metafield; without it the version is `unversioned`. A feed cannot detect an undisclosed reformulation, so the operator must update that metadata when a formula changes. A stable formula key is normalized vendor plus product title; name changes conservatively require review.

Deleted/re-imported variants retain history. Unique vendor plus SKU/barcode matches, or weaker formula/shade identities, offer `candidate_label_id` for review. Nothing reattaches approved evidence automatically. The admin must confirm formula/version and create or bind the reviewed revision. Conflicting candidates remain unverified.

## Matching and limits

`chooseAvailableShades` is a pure on-device stock fallback. It preserves the unavailable best shade ID for explanation, then ranks suitable verified in-stock same-formula options ahead of cross-brand options. It checks depth-band proximity and known base undertone, finish, coverage, currency, and budget. The caller supplies validated suitability limits and explicit preferences. It never treats a within-formula rank as a cross-brand colour distance, forces an option, or emits an exact-match claim.

The app reads `catalog_recommendable` through an authenticated, paginated projection. It refreshes on foregrounding and once per minute while mounted; failures and empty results show an explicit retry state, never synthetic products. Synthetic products remain only in the explicit demo build and test fixtures. Camera-offline builds make no catalogue or Shopify requests.

Home and product detail use actual variant IDs, prices and reviewed evidence. The current UI supports USD only; other currencies are rejected rather than mislabelled. Missing finish, images and swatches are shown as unavailable, not invented. An unavailable previously viewed shade can offer alternatives after the shopper confirms the displayed finish, coverage and budget criteria; matching stays in the same depth band and uses the shared same-formula-first ranking.

After the existing Shopify privacy notice is accepted, Storefront reads join only currently approved variant IDs. Persistent commerce caches are disabled because they cannot establish current approval. Adding a shade rechecks the view and sends only its variant ID and quantity to Shopify. No skin, scan or recommendation context is sent. Shopify still verifies final price and inventory at checkout.

Operators label shades with the labelling CLI; there is no admin UI yet. The shade-engine branch's measured-colour adapter still needs integration and validation. Match My Foundation estimates are imported only as unverified source data (migration 0038). No feedback logging is loaded; that requires its separate approved step.

## Reconcile runtime and health

Migration `0040_catalog_sync_scale.sql` adds service-only durable reconcile jobs. Each page fetches at most 100 product IDs, with up to eight product fetches in flight. Nested product reads start with one inventory location per variant; all remaining locations and variant pages are still traversed. The adapter meters requests against returned Shopify cost information, backs off before its local budget is depleted, and fails on HTTP 429 or GraphQL throttling instead of retrying in a hot loop. Another worker or app can consume Shopify's shared bucket, so throttling remains a retriable outcome, not a completeness signal.

An invocation starts another page only within a 75-second work window. Shopify requests have a 95-second invocation deadline and a 15-second per-request timeout; persistence has a 15-second timeout. A completed page is applied together with its cursor in one database transaction. The lease token fences expired workers. Only the final page may mark missing products and report the run complete. A failed page leaves that page's existing rows intact; earlier fully checkpointed pages remain, and no missing-product sweep runs. Newer webhook observations remain protected by the existing observation ordering.

The handler returns 202 after a normal checkpointed yield, or 503 after a failed attempt. The minutely `truetone-catalog-continuation` job retries pending or expired leases using the same Vault URL/token as the nightly job. It does nothing when those secrets are missing. Failures wait at least a minute. Normal yields do not increment failure counts. Three failed attempts on the same page atomically fail both the job and its sync run, clear the lease, and release the single live-job slot. A successful page resets that page's attempt count, not the lifetime failure count. Terminal failure never runs the missing-product sweep.

Retry a pending job with a service-side POST containing `{"job_id":"<uuid>"}`. A terminal job cannot be reclaimed. After correcting its cause, POST an empty body to start a new run, or let the next nightly schedule start it. Never delete job rows or overwrite approved evidence to retry. The fixed failure class is retained and emitted as `catalog_reconcile_terminal_failure`; upstream messages, customer data, and secrets are not logged.

Unknown query shapes reserve up to the 1,000-point single-query ceiling until Shopify reports their requested cost. Requested costs determine later reservations; actual costs refund unused points. The three fixed query shapes' learned costs persist at checkpoints and failed attempts, and a new invocation restores them. Learned costs do not imply a restored bucket balance: each invocation calibrates its available budget with Shopify's response. External consumers can still trigger throttling, which remains a failed attempt rather than a successful partial traversal. See [Shopify's GraphQL rate limits](https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits).

Check the alert conditions with a trusted service-role connection:

```sql
select public.catalog_sync_health(now());
```

The result has five booleans: `stale` when no complete run exists in 26 hours, `stuck` when a running job has made no checkpoint progress for five minutes, `rising_failures` when at least three failed/blocked runs in the last hour exceed the preceding hour, `retrying` when a pending job has at least three lifetime failed attempts, and `terminal_failure` when a job failed within 26 hours. `last_failure_code` supplies the latest terminal failure's fixed class, or null. Alert on any true value. The check and tests are implemented; routing the result to the operator's chosen alert channel remains deployment configuration, not an extra data-egress integration in this branch.

Reconcile and webhook entry points log fixed event names and failure classifications only. They never log error messages, upstream bodies, headers, credentials, request payloads or customer data. Correlate operational state through the private sync/job tables, not arbitrary exception text.

Run `node --experimental-strip-types scripts/benchmark-catalog-reconcile.mjs /tmp/reconcile-benchmark.json` for five alternating baseline/current runs against a synthetic 3,000-product Shopify transport. It asserts all 3,000 products are saved before completion. The default mock latency is 10 ms/request and 1 ms/product persistence; its cost bucket is deliberately unthrottled to isolate concurrency. It makes no Shopify or Supabase calls and does not establish throughput under a real Shopify plan. Lease, resume, failure and final-only deletion semantics are separately covered by pgTAP.
