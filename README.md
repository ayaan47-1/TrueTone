# TrueTone

An honest, skin-tone-fair read of skin **appearance** and a brand-neutral skincare routine.
TrueTone is a **cosmetic / general-wellness product — not a medical device, and it never
diagnoses anything.**

> **Engineering + compliance guardrails live in [`CLAUDE.md`](./CLAUDE.md). Read it before
> touching anything that captures, stores, or describes skin or face data.** The rules there
> (BIPA / WA MHMDA / PIPA / FTC) are load-bearing, not style preferences.

- **Platform:** Expo (SDK 56) + React Native + TypeScript · iOS-primary · **US-only for v0** · **18+ only**
- **Status:** **P1 (compliance scaffold), P2 (guided capture + on-device read), the fairness-eval
  harness, and the brand-neutral routine + scores-only chat are all built and landed on `main`.**
  The remaining open work is **on-device verification of the camera + inference path in an Expo dev
  build on a physical iPhone**, plus the progress/trend re-scan loop — see [Roadmap](#roadmap).

---

## What's built

### P1 — compliance scaffold

Built **before** the camera existed so the scan slots in behind it without a retrofit. Everything a
regulator looks for is wired up first:

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

### P2 — guided capture + on-device read

The scan pipeline, built so **all real logic is pure and Jest-tested**; only the camera and native
inference are thin **device-only shells** over it. The raw image never crosses the compliance
boundary.

- **Guided capture** (`react-native-vision-camera` v5) — a blocking quality gate (face presence /
  centering / distance, brightness, sharpness) must pass, then an auto-capture state machine fires a
  3-2-1 countdown. The captured file URI is handed to the read **only** — never logged or uploaded.
- **On-device read** (`react-native-executorch`) — decodes the photo, runs a **deep-stub model on
  the real Executorch runtime** (placeholder weights, so the real model is a file swap), derives a
  cosmetic `ScoreVector` + skin-type, then **deletes the image** (success or failure).
- **Scores persistence + results** — derived scores (never the image) are written via a
  `SECURITY DEFINER` `record_scan` RPC into an append-only `scans` table (RLS-scoped); a
  dimension-list results screen renders **bands only**, never diagnostic language.
- **Image-egress CI guard** — `npm run check:no-egress` fails the build if image data could reach a
  network/log sink.

> **Device-gated:** the camera and Executorch native calls cannot run under Jest or the iOS
> Simulator. They are isolated behind `// DEVICE-ONLY` shells and are verified in an Expo dev build
> on a physical iPhone (tracked in the open guided-capture PR).

### Routine + scores-only chat (build-order step 6)

- **Brand-neutral routine** — a pure, deterministic engine turns scores + skin type into an
  approved-vocabulary routine **on-device**, persisted 1:1 on the `scans` row (inheriting all
  RLS / retention / delete machinery).
- **Scoped chat** — a single Supabase Edge Function (`routine-chat`) is the only LLM/network piece.
  It loads the caller's scores + routine under RLS, **hard-refuses** any mole/lesion/cancer query
  with a dermatologist referral (the LLM is never called on that path), builds a constrained Claude
  prompt from **band labels (not raw scores)**, and runs every reply through the cosmetic
  post-filter (fail-closed). The Anthropic key is **server-side only**; chat is ephemeral.

### Fairness-eval harness (parallel track)

- A standalone `eval/` **dev tool** (never bundled): Fitzpatrick I–VI labeling schema + a host/CI
  harness aggregating per-Fitzpatrick metrics — quality-gate pass-rate parity, score stability, and
  systematic bias. Raw eval images **never enter git or the backend**; only aggregate reports are
  committed. Thresholds are **provisional and policy-owned** — the harness reports, it does not
  certify fairness.

The architecture and full module map live in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App shell | Expo SDK 56, Expo Router, NativeWind, TypeScript |
| Auth | `@supabase/supabase-js` v2 — **anonymous-first** (stable user id from launch) |
| Capture | `react-native-vision-camera` v5 (guided front-camera + quality gate) |
| On-device read | `react-native-executorch` (deep-stub model on the real runtime; device-only shell) |
| Backend | Supabase: Postgres + Auth + Row-Level Security + RPCs (`SECURITY DEFINER`) + `pg_cron` + Edge Functions |
| Routine chat | Supabase Edge Function (Deno) → Anthropic Claude (Sonnet 4.6), **server-side key only** |
| DB testing | pgTAP (`supabase test db`) |
| App testing | Jest (`jest-expo`) + `@testing-library/react-native` 14 (+ `test-renderer`) |
| Integration | Node's built-in test runner (`node --test`) against local Supabase |
| Fairness eval | TypeScript dev tool under `eval/` — Jest + `zod` (host/CI only, never bundled) |

> The compliance boundary is non-negotiable: the **raw face image lives and dies on the device**;
> only **derived cosmetic scores** ever cross to the backend. The capture/on-device-read code
> honors this (image deleted after the read; egress guarded by `check:no-egress`) — see
> [`CLAUDE.md` §3](./CLAUDE.md).

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
  scan/                  capture → result → routine (P2 + step 6)
src/
  lib/                   supabase client, anon auth, region check, routing guard, profile context
  features/
    age-gate, consent, data-rights, onboarding, policies   (P1)
    capture/             guided camera + quality gate + auto-capture controller (device-only shell)
    read/                preprocess, decode, image lifecycle, bands, executorch engine (device-only shell)
    recommend/           deterministic routine engine, skincare library, RoutineView, scoped chat
  content/               policy manifest (version source of truth) + markdown/bodies
supabase/
  migrations/            0001 schema → 0010 routine (scans, scan RPCs, backup purge, routine)
  functions/             routine-chat Edge Function (+ _shared compliance copies)
  tests/                 pgTAP suites (RLS, consent immutability, RPCs, retention, scans)
scripts/                 check-no-analytics-sdk.mjs + check-no-image-egress.mjs (CI guards)
eval/                    fairness-eval dev tool (Fitzpatrick metrics; host/CI only, never bundled)
test/                    Jest setup + node:test integration (gate-flow, scans)
docs/                    architecture + ops checklists + superpowers plans/specs
data/                    compliance spec PDFs (source of truth, not shipped)
```

---

## Getting started

### Prerequisites

- Node 22+ (`@supabase/realtime-js` requires native `WebSocket`, which lands in Node 22)
- Docker (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase` works)
- A physical iPhone + an Expo dev build for any camera / on-device-read work (the iOS Simulator
  has no camera and cannot load the vision-camera / Executorch native modules)

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
npm test                 # Jest unit/component tests (app/src + eval harness; coverage gate enforced)
npm run test:coverage    # with coverage (Jest global gate: 80% lines/stmts/funcs, 70% branches)
npm run test:integration # node --test against a running local Supabase (gate-flow + scans E2E)
npm run check:compliance # fails if any ad/analytics SDK is present
npm run check:no-egress  # fails if the raw image could reach a network/log sink
npx supabase test db     # pgTAP suites (RLS isolation, consent immutability, RPCs, retention, scans)
```

CI ([`.github/workflows/compliance.yml`](.github/workflows/compliance.yml)) runs
`check:compliance` + `check:no-egress` + `npm test` on every push and PR. Integration and pgTAP
tests need a live Supabase and run separately.

---

## Roadmap

Build order (P1 first — biometric compliance cannot be retrofitted):

1. ✅ 18+ age gate (neutral DOB)
2. ✅ Standalone biometric consent + consent logging
3. ✅ Data-rights screens (withdraw / delete-everything / account deletion)
4. ✅ Privacy / Terms / Biometric / Retention / WA-health policies reachable before scan
5. ✅ Guided capture + on-device read → cosmetic scores *(code landed; on-device verification in an
   Expo dev build on a physical iPhone is the open work)*
6. ✅ Brand-neutral routine + scores-only "why this" chat
7. ⏳ Progress re-scan + honest trend + "did this help?" loop

Parallel track:

- ✅ Fairness-eval harness — balanced Fitzpatrick I–VI labeling + per-group metrics (runs on
  synthetic fixtures now; the real image→read extractor is gated on the model + counsel-approved
  data).

Plans and specs: [`docs/superpowers/`](./docs/superpowers/).

---

*Engineering/compliance guidance current to mid-2026 — **not legal advice**. A licensed Illinois
privacy/biometric attorney reviews before public launch. Policy bodies in `src/content/` are
placeholders pending counsel review (the Biometric Data Policy carries the mandatory BIPA §15(b)
summary inline).*
