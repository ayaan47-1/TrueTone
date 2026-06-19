# TrueTone

An honest, skin-tone-fair read of skin **appearance** and a brand-neutral skincare routine.
TrueTone is a **cosmetic / general-wellness product — not a medical device, and it never
diagnoses anything.**

> **Engineering + compliance guardrails live in [`CLAUDE.md`](./CLAUDE.md). Read it before
> touching anything that captures, stores, or describes skin or face data.** The rules there
> (BIPA / WA MHMDA / PIPA / FTC) are load-bearing, not style preferences.

- **Platform:** Expo (SDK 56) + React Native + TypeScript · iOS-primary · **US-only for v0** · **18+ only**
- **Status:** **P1 (compliance scaffold) is complete and landed.** P2 (guided capture + on-device
  read) is designed and planned but **not yet implemented** — see [Roadmap](#roadmap).

---

## What P1 ships

P1 builds the compliance scaffold **before** the camera exists, so the scan (P2) slots in behind
it without a retrofit. Everything a regulator looks for is wired up first:

- **18+ age gate** — neutral date-of-birth entry. The DOB is computed locally and **never
  persisted**; only a derived `is_18_plus` boolean + verification timestamp are stored.
- **Biometric consent** (BIPA §15(b) + WA MHMDA) — standalone screen, **no pre-checked box**,
  "I Consent" disabled until the user actively checks. Consent is written to an **append-only,
  immutable** `consent_log` that pins the exact policy version at the time of the action.
- **Data rights** — in-app withdraw consent, delete-my-data, and full account deletion, each
  behind a confirmation dialog.
- **Versioned legal policies** — Privacy, Terms, Biometric Data, Retention, and WA Consumer Health
  Data, reachable before any scan. A single manifest version (`POLICY_VERSION`) is the source of
  truth and seeds the database.
- **US-only geo gate** — coarse region check that **fails closed** (non-US and undeterminable both
  blocked).
- **3-year inactivity retention sweep** — nightly `pg_cron` job de-identifies consent history and
  purges accounts inactive > 3 years (BIPA §15(a)).
- **No-analytics-SDK CI guard** — the build **fails** if any ad/analytics SDK (Firebase Analytics,
  Meta SDK, Segment, Amplitude, Mixpanel, AppsFlyer, Branch, Google Mobile Ads) reaches the
  dependency tree or Expo config.

The architecture and full module map live in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App shell | Expo SDK 56, Expo Router, NativeWind, TypeScript |
| Auth | `@supabase/supabase-js` v2 — **anonymous-first** (stable user id from launch) |
| Backend | Supabase: Postgres + Auth + Row-Level Security + RPCs (`SECURITY DEFINER`) + `pg_cron` |
| DB testing | pgTAP (`supabase test db`) |
| App testing | Jest (`jest-expo`) + `@testing-library/react-native` 14 (+ `test-renderer`) |
| Integration | Node's built-in test runner (`node --test`) against local Supabase |

> The compliance boundary is non-negotiable: the **raw face image lives and dies on the device**;
> only **derived cosmetic scores** ever cross to the backend. P2 capture/on-device-read code must
> honor this — see [`CLAUDE.md` §3](./CLAUDE.md).

---

## Project layout

```
app/                     Expo Router routes (gated by a fail-closed routing guard)
  _layout.tsx            ProfileProvider + routing guard mount
  index.tsx              Home / onboarding (standing disclaimer)
  age-gate.tsx           18+ gate
  consent.tsx            Biometric consent
  data/index.tsx         "Your Data" (withdraw / delete / account)
  policies/              Policy list + dynamic policy reader
  region-blocked.tsx     Not-available-in-region screen
src/
  lib/                   supabase client, anon auth, region check, routing guard, profile context
  features/              age-gate, consent, data-rights, onboarding, policies
  content/               policy manifest (version source of truth) + markdown/bodies
supabase/
  migrations/            0001 schema → 0006 seed policies
  tests/                 pgTAP suites (RLS, consent immutability, RPCs, retention)
scripts/                 check-no-analytics-sdk.mjs (CI compliance guard)
test/                    Jest setup + node:test integration (gate-flow)
docs/                    architecture + superpowers plans/specs
data/                    compliance spec PDFs (source of truth, not shipped)
```

---

## Getting started

### Prerequisites

- Node 22+ (`@supabase/realtime-js` requires native `WebSocket`, which lands in Node 22)
- Docker (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase` works)
- A physical iPhone for any camera work (the iOS Simulator has no camera; P2+)

### Install

```bash
npm install        # .npmrc sets legacy-peer-deps=true (Expo Router 56 peer mismatch)
```

### Local Supabase + env

```bash
npx supabase start
cp .env.example .env
# Paste the legacy ANON_KEY JWT printed by `npx supabase status` into:
#   EXPO_PUBLIC_SUPABASE_ANON_KEY
# (Local emits sb_publishable_… keys too, but the app uses the legacy ANON_KEY.)
```

#### Edge Function secrets

The `routine-chat` Edge Function requires one server-side secret — set it once and it is never
exposed to the client or the app `.env`:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`ANTHROPIC_API_KEY` must be a Supabase Edge Function secret (`npx supabase secrets set`).
It is **server-side only** — it must never appear in the app `.env` or be shipped to the client.

### Run the app

```bash
npm start          # Expo dev server (Expo Go is fine for all P1 screens — no native modules yet)
npm run ios        # iOS
npm run android    # Android
```

> Switch to an **Expo development build** (`expo-dev-client` + EAS Build) the moment P2 camera or
> on-device ML is added — Expo Go cannot load custom native modules.

---

## Testing & checks

```bash
npm test                 # Jest unit/component tests
npm run test:coverage    # with coverage (P1 final: 87% stmts / 83% branch / 80% funcs / 96% lines)
npm run test:integration # node --test against a running local Supabase (gate-flow E2E)
npm run check:compliance # fails if any ad/analytics SDK is present
npx supabase test db     # pgTAP suites (RLS isolation, consent immutability, RPCs, retention)
```

CI ([`.github/workflows/compliance.yml`](.github/workflows/compliance.yml)) runs
`check:compliance` + `npm test` on every push and PR. Integration and pgTAP tests need a live
Supabase and run separately.

---

## Roadmap

Build order (P1 first — biometric compliance cannot be retrofitted):

1. ✅ 18+ age gate (neutral DOB)
2. ✅ Standalone biometric consent + consent logging
3. ✅ Data-rights screens (withdraw / delete-everything / account deletion)
4. ✅ Privacy / Terms / Biometric / Retention / WA-health policies reachable before scan
5. ⏳ Guided capture + on-device read → cosmetic scores *(P2 — designed, not yet built; dev build + real iPhone)*
6. ⏳ Brand-neutral routine + "why this product" chat (scores only)
7. ⏳ Progress re-scan + honest trend + "did this help?" loop

Plans and specs: [`docs/superpowers/`](./docs/superpowers/).

---

*Engineering/compliance guidance current to mid-2026 — **not legal advice**. A licensed Illinois
privacy/biometric attorney reviews before public launch. Policy bodies in `src/content/` are
placeholders pending counsel review (the Biometric Data Policy carries the mandatory BIPA §15(b)
summary inline).*
