# TrueTone Architecture & Codemap

> Reflects the **P1 compliance scaffold** as landed (migrations `0001`–`0006`, all app/src/lib
> modules below). P2 (capture + on-device read) is design-only and not represented here yet.
> Source of truth for *rules*: [`../CLAUDE.md`](../CLAUDE.md). This doc maps *what exists*.

## The compliance boundary

```
ON DEVICE  →  capture → quality gate → on-device read → cosmetic scores      (P2, not built)
                                  (raw image deleted here)
──────────────── compliance boundary: only derived scores cross ────────────────
BACKEND    →  Supabase (auth, consent log, retention) + LLM routine/chat (scores only)   (P1 = no image, no scan)
```

In P1 there is no image and no scan yet — the entire scaffold (auth, gating, consent, data rights,
policies, retention) sits on the backend side of that boundary. P2 must keep the face image on the
device; only derived scores may cross.

## DB-core-first design

Postgres holds the compliance **guarantees**; the Expo app is a thin, **fail-closed** client.

- **RLS** isolates every user's rows.
- **`SECURITY DEFINER` RPCs** are the only way the client mutates consent/profile state, so the
  rules can't be bypassed from the client.
- **A trigger** makes `consent_log` append-only (the legal record).
- **`pg_cron`** runs the retention sweep server-side, independent of any client.
- **Anonymous-first auth** gives a stable user id from first launch (no signup wall before the
  gates).

---

## App routing (Expo Router)

`app/_layout.tsx` wraps the stack in `ProfileProvider` and a `Guard`. The guard reads
`useProfile()` and renders a redirect based on the computed `route`:

| State | Screen | Route file |
|-------|--------|-----------|
| loading | spinner | `_layout.tsx` |
| error | error message (never advances to home) | `_layout.tsx` |
| `region-blocked` | not available in your region | `region-blocked.tsx` |
| `age-gate` | 18+ DOB entry | `age-gate.tsx` → `features/age-gate/AgeGate` |
| `consent` | biometric consent | `consent.tsx` → `features/consent/Consent` |
| `home` | onboarding + disclaimer | `index.tsx` → `features/onboarding/Onboarding` |

Always-reachable: `policies/index.tsx` (list) and `policies/[doc].tsx` (reader);
`data/index.tsx` ("Your Data").

## Gating logic — `src/lib/`

The gate decision is a **pure function** so it's trivially testable:

```ts
// routing-guard.ts
nextRoute({ isUS, is18, consent }): 'region-blocked' | 'age-gate' | 'consent' | 'home'
//   isUS !== true → region-blocked   (fail closed: null AND false both block)
//   !is18         → age-gate
//   !consent      → consent
//   else          → home
```

| File | Purpose | Key exports |
|------|---------|-------------|
| `supabase.ts` | Supabase client singleton (AsyncStorage session; local fallback under Jest) | `supabase` |
| `auth.ts` | Anonymous session bootstrap (fail-closed); upserts profile + bumps `last_interaction_at` | `bootstrapSession(): Promise<string>` |
| `region.ts` | Coarse US region check via `expo-localization` | `isUSRegion(): boolean \| null` |
| `routing-guard.ts` | Pure gate-decision function | `nextRoute`, `GateState`, `Route` |
| `profile-context.tsx` | React context: bootstraps session, fetches profile, feeds `nextRoute` | `ProfileProvider`, `useProfile()` |

`profile-context` fails closed: on any error it sets `error = true` and never routes to `home`.

## Feature modules — `src/features/`

| Module | What it does | Compliance-critical behavior |
|--------|--------------|------------------------------|
| `age-gate/age.ts` | `computeIs18Plus(dob, now)` — precise age | pure; no persistence |
| `age-gate/AgeGate.tsx` | DOB entry screen | **DOB never persisted** — only `is_18_plus` + `age_verified_at` written; under-18 input is discarded |
| `consent/consent-copy.ts` | Versioned disclosure text | mirrors BIPA §15(b) + MHMDA (what / purpose / retention) |
| `consent/Consent.tsx` | Consent screen | checkbox **not pre-checked**; button disabled until checked; calls `record_consent` RPC |
| `data-rights/DataRights.tsx` | Withdraw / delete-data / delete-account | each calls its RPC behind a `confirm()` dialog |
| `onboarding/Onboarding.tsx` | Home + standing disclaimer | "not a medical device; AI estimate; see a dermatologist" |
| `policies/PolicyList.tsx` | Lists docs from manifest | — |
| `policies/PolicyReader.tsx` | Renders one policy body | — |

## Content & versioning — `src/content/`

- `manifest.ts` — **single source of truth** for `POLICY_VERSION` (`'2026-06-15.1'`, format
  `YYYY-MM-DD.N`), the `DocKey` union, and `POLICY_DOCS` (key → title). Mirrored by the DB seed
  (`0006`).
- `bodies.ts` — `POLICY_BODIES: Record<DocKey, string>` rendered by the reader. Most are
  placeholders pending counsel; the **biometric** body carries the mandatory BIPA §15(b) summary
  inline.
- `*.md` — markdown source for the five docs: `privacy`, `terms`, `biometric`, `retention`,
  `wa_health`.

---

## Backend — `supabase/`

### Data model (`0001_schema.sql`)

| Table | Key | Notable columns | Purpose |
|-------|-----|-----------------|---------|
| `profiles` | `id` (FK `auth.users`) | `is_18_plus`, `age_verified_at`, `consent_active`, `last_interaction_at` | per-user state; `last_interaction_at` drives the 3-yr sweep |
| `policy_versions` | **`(version, doc_key)`** | `is_current`, `effective_at` | immutable policy registry; partial unique index → one current row per doc |
| `consent_log` | `id` | `action` (`consented`/`withdrawn`/`deleted`), `policy_version`, `policy_doc_key` | **append-only** BIPA receipt; composite FK pins a real policy version |
| `retention_runs` | `id` | `ran_at`, `purged_count` | audit of sweep executions |

### RLS (`0002_rls.sql`)

- `profiles` / `consent_log`: users can only `select`/`insert` (and `profiles` `update`) **their own
  rows** (`= auth.uid()`). No client `update`/`delete` on `consent_log`.
- `policy_versions`: world-readable (`anon` + `authenticated`).
- `retention_runs`: RLS on, no policies → not client-readable.
- `FORCE ROW LEVEL SECURITY` intentionally **not** set (would subject the `SECURITY DEFINER` sweep
  to RLS and break cross-user purge).

### Immutability (`0003_consent_immutability.sql`)

`block_consent_mutation()` trigger: **DELETE always blocked**; **UPDATE blocked except
de-identification** (`user_id → null`). This is what lets the delete RPCs and the sweep de-identify
receipts without superuser (`session_replication_role`).

### RPCs (`0004_rpcs.sql`) — all `SECURITY DEFINER`, granted to `authenticated`

| RPC | Effect |
|-----|--------|
| `record_consent()` | **Idempotent**: if already consented, bumps `last_interaction_at` and returns the existing receipt; else inserts a `consented` row + sets `consent_active = true`. Pins the current `biometric` policy version. |
| `withdraw_consent()` | Inserts a `withdrawn` row; sets `consent_active = false`. |
| `delete_my_data()` | Inserts a `deleted` receipt; de-identifies prior consent rows (`user_id → null`); resets derived data; **keeps the account**. |
| `delete_account()` | Runs `delete_my_data()`, then hard-deletes `profiles` + `auth.users`. |

### Retention (`0005_retention_cron.sql`)

`truetone_retention_sweep()` purges profiles with `last_interaction_at < now() - interval '3 years'`:
inserts a `deleted` receipt, de-identifies their consent rows, deletes profile + `auth.users`,
records `purged_count` in `retention_runs`. Scheduled:

```sql
select cron.schedule('truetone-retention', '0 3 * * *',
  $$ select public.truetone_retention_sweep(); $$);   -- daily 03:00 UTC
```

The "purpose-met" deletion arm is **deferred to P2** (no scan/purpose exists yet).

### Seed (`0006_seed_policies.sql`)

Seeds all five docs at `2026-06-15.1` as current (idempotent `on conflict do nothing`); mirrors
`manifest.ts`.

### pgTAP tests (`supabase/tests/`)

| File | Verifies |
|------|----------|
| `schema.test.sql` | tables, PKs, composite FK enforcement |
| `rls_isolation.test.sql` | cross-user isolation; world-readable policies; RLS-enabled guard |
| `consent_immutable.test.sql` | UPDATE/DELETE on `consent_log` blocked (P0001) |
| `rpc_consent.test.sql` | `record_consent` idempotency + version pinning |
| `rpc_delete.test.sql` | derived data cleared, receipt logged, prior rows de-identified |
| `retention.test.sql` | stale user purged, active kept, run logged |

---

## Compliance CI guard — `scripts/check-no-analytics-sdk.mjs`

`findForbidden(text)` scans `package.json`, `package-lock.json`, and Expo config for forbidden
ad/analytics SDKs (Firebase Analytics, Meta/FB SDK, Segment, Google Mobile Ads, AppsFlyer,
Amplitude, Mixpanel, Branch) and exits non-zero on any hit — the "GoodRx/BetterHelp/Flo trap"
guard. Wired into `npm run check:compliance` and the `compliance` GitHub workflow.

## Test topology

- **Unit/component** — Jest (`jest-expo`) + RTL 14. RTL 14's `render`/`fireEvent` are **async**.
  `app/_layout.tsx`/`profile-context` covered via route-wrapper + integration tests.
- **Integration** — `node --test test/integration/**/*.test.mjs` (jest-expo breaks `supabase-js`'s
  `fetch`; plain Node works). Needs a running local Supabase. Excluded from the default jest run.
- **DB** — pgTAP via `npx supabase test db`.
