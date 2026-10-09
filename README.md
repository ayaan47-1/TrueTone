# TrueTone

An honest, skin-tone-fair read of your skin **tone and undertone** from one selfie, on-device, that
**matches you to makeup** — foundation shade, undertone, and finish built for every tone — as a
brand-neutral shade-match and shoppable shelf. TrueTone is a **cosmetic / general-wellness product —
not a medical device, and it never diagnoses anything.**

> **Engineering + compliance guardrails live in [`CLAUDE.md`](./CLAUDE.md). Read it before
> touching anything that captures, stores, or describes skin or face data.** The rules there
> (BIPA / WA MHMDA / PIPA / FTC) are load-bearing, not style preferences.

- **Platform:** Expo (SDK 56) + React Native + TypeScript · iOS-primary · **US-only for v0** · **18+ only**
- **Status (R1 unified release, `release/tt-r1-unified`):** the makeup shade-match pivot has
  **landed and is wired** — the app you open today is the **Shop-first** experience: a four-tab
  shell (**Shop · For You · Community · Account**), the on-device shade read feeding a brand-neutral
  shoppable shelf, a scan-share flow, a Community feed with a user routine-logger that publishes
  into it, and a username/avatar identity seam. See
  [What's built → Makeup shade-match, shop & community](#makeup-shade-match-shop--community-shipped)
  for the full built-and-navigable breakdown, and
  [`docs/COFOUNDER_HANDOFF.md`](docs/COFOUNDER_HANDOFF.md) for a practical file-by-feature map if
  you're about to make a change.
- The P1 compliance scaffold, P2 guided capture + on-device read, the brand-neutral skincare-routine
  recommender + scores-only chat, the progress-trend + "did this help?" loop, the "Mist" design
  system, and the fairness-eval harness remain the compliance/scan foundation underneath all of the
  above. The guided-capture flow runs **end-to-end on a physical device** (Android dev build)
  against the **real classical-CV on-device read** (fairness-instrumented).
- Remaining open work: the vision-camera worklet quality metrics, the iOS device path, and
  gated/dark features awaiting validation data (the absolute "skin age" number; premium billing) —
  see [Roadmap](#roadmap).

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
- **On-device read** (`CvReadEngine`, classical computer vision) — decodes the photo, samples skin
  regions, derives a cosmetic `ScoreVector` + skin-type with no network or ML model, then **deletes
  the image** (success or failure). It is **fairness-instrumented** — the eval harness exercises it
  on a synthetic Fitzpatrick I–VI tone self-test (a tone-invariance check of the algorithm);
  validation on real, consented skin-tone data is a separate, legally-gated step (no equity claim
  ships from synthetic results). A future ML model can drop in behind the same `ReadEngine` interface
  (an `executorch-engine` shell exists), but the shipped read is classical CV.
- **Scores persistence + results** — derived scores (never the image) are written via a
  `SECURITY DEFINER` `record_scan` RPC into an append-only `scans` table (RLS-scoped); a
  dimension-list results screen renders **bands only**, never diagnostic language.
- **Image-egress CI guard** — `npm run check:no-egress` fails the build if image data could reach a
  network/log sink.

The flow runs **end-to-end on a physical device** (Android dev build): gates are enforced by
imperative navigation, the guided camera mounts, and capture → the **real classical-CV read** →
result renders real cosmetic bands. The capture route calls `runRead()`, which runs `CvReadEngine`
on-device (deleting the image) and persists only derived scores via the `record_scan` RPC. Two
clearly-flagged items remain, neither weakening compliance:

- **Preview-only stub** — `stubRead()` returns deterministic placeholder scores marked
  `isStub: true` and is reached **only** in `__DEV__` web/Expo Go preview, where native image decode
  is unavailable. On a real dev build `CvReadEngine` runs; the stub is never the device read.
- **Frame-processor flag** — `FRAME_PROCESSORS_INSTALLED=false` gates the face-detector/luma
  worklets so the camera renders without `react-native-vision-camera-worklets` (a native dep needing
  a rebuild); the quality gate runs on a scripted simulation until the flag is flipped.

> **Still device-gated:** the worklet-backed quality metrics and a full physical-device verification
> pass cannot run under Jest or the iOS Simulator. They stay isolated behind `// DEVICE-ONLY` shells.

### Design system — "Mist" (liquid glass)

A soft-surrealism, liquid-glass UI: mist-lavender / washed-rose palette, Fraunces + Mulish type, and
`expo-blur` frosted surfaces over an `expo-linear-gradient` mesh. Shared primitives live in
`src/components/ui/` (`MistBackground`, `Screen`, `GlassCard`, `GlassSheet`, `Button`, `Typography`)
with design tokens in `src/theme/tokens.ts`. The age gate and the policy reader present as frosted
**glass popups** (the reader is a `transparentModal` route); result bands render in soft sage / mauve
/ clay pills via a per-dimension polarity map.

The app home is a four-tab layout — **Shop · For You · Community · Account** — under a **floating
glass tab bar** (`GlassTabBar`), landing on Shop; the shade scan is a header icon on For You, not a
tab (see [Makeup shade-match, shop & community](#makeup-shade-match-shop--community-shipped)). This
also surfaces the Routine (skincare), chat, Data Rights, and Policies screens, plus the within-user
trend card (`AgeTrendCard`), which now renders on the scan result screen rather than a dedicated
Trend tab. Layout is **foldable-aware** (Galaxy Fold): `Screen` applies safe-area insets additively
and caps/centers content on wide screens, and `use-responsive` scales surfaces across the folded +
unfolded aspect ratios (edge-to-edge is mandatory on Expo SDK 56). Portrait stays locked.

> **Presentation-only, compliance preserved:** all compliance copy and `testID`s are unchanged, and
> no analytics/ad SDK was added (both CI guards still pass). The design's "tuned fairly for every
> tone" caption is a skin-tone-equity claim gated on validation data (`CLAUDE.md` §1/§6), so the
> Fitzpatrick I–VI tone strip ships with the **factual** "Fitzpatrick I–VI" caption instead.

### Routine + scores-only chat (build-order step 6)

- **Brand-neutral routine** — a pure, deterministic engine turns scores + skin type into an
  approved-vocabulary routine **on-device**, persisted 1:1 on the `scans` row (inheriting all
  RLS / retention / delete machinery).
- **Scoped chat** — a single Supabase Edge Function (`routine-chat`) is the only LLM/network piece.
  It loads the caller's scores + routine under RLS, **hard-refuses** any mole/lesion/cancer query
  with a dermatologist referral (the LLM is never called on that path), builds a constrained Claude
  prompt from **band labels (not raw scores)**, and runs every reply through the cosmetic
  post-filter (fail-closed). The Anthropic key is **server-side only**; chat is ephemeral.

### Progress trend + "did this help?" (build-order step 7)

- **Within-user trend** — an `AgeTrendCard` shows a *relative* freshness/trend read computed from the
  user's own stored cosmetic scores (no cross-user comparison, no validation gate), plus a "Scan
  again" entry. The `scans` table was already append-only, so trend needed **no schema change**.
- **Routine feedback** — a `RoutineFeedbackPrompt` records whether a routine helped
  (`routine_helpful` ∈ `helped`/`no_change`/`worse`) on the scan row via a `SECURITY DEFINER` RPC
  (`0012_routine_feedback.sql`), inheriting RLS / delete / retention.
- **Absolute "skin age" — built dark, triple-gated OFF.** A concrete "your skin looks like ~N" number
  is an accuracy claim, so it must not ship without validation data (FTC §5 / ICFA). The engine is
  built but gated: `SKIN_AGE_ABSOLUTE_ENABLED = false` → `estimateSkinAge()` returns `null` → the DB
  column stays `null` → the UI gates on the flag. It stays dark until validation data is on file **and**
  founder/legal sign-off flips it. Age is computed on-device from the in-memory read (never the image).
- **Premium entitlement seam** — display-only `hasAgeAccess()` boolean; the billing path (RevenueCat
  adapter) is **deferred** and **never imports scores/reads/image** (billing sees no biometric data).

### Fairness-eval harness (parallel track)

- A standalone `eval/` **dev tool** (never bundled): Fitzpatrick I–VI labeling schema + a host/CI
  harness aggregating per-Fitzpatrick metrics — quality-gate pass-rate parity, score stability, and
  systematic bias. Raw eval images **never enter git or the backend**; only aggregate reports are
  committed. Thresholds are **provisional and policy-owned** — the harness reports, it does not
  certify fairness.

### Makeup shade-match, shop & community (shipped)

The pivot has landed: the same on-device read feeds a **makeup shade-match** layer, and the app's
navigation now runs **Shop-first**. All of the shade/match logic is pure and Jest-tested; it
consumes **only the derived read descriptors, never the image** (the compliance boundary is
unchanged, see [`CLAUDE.md` §3](./CLAUDE.md)).

- **Navigation** — four tabs: **Shop · For You · Community · Account** (`app/(tabs)/_layout.tsx`,
  landing on Shop). There is no Trend tab and no bottom-tab Scan; the shade scan is a camera icon in
  the For You header (`app/(tabs)/index.tsx`) that pushes `/scan-gate` (on-device privacy reassurance)
  → the full-screen camera route, which lives **outside** the tab navigator.
- **Shade derivation** (`src/features/shade/`) — `deriveShade()` maps the read (tone lightness /
  warmth / olive cast / oiliness / skin-type) to a **foundation shade**: a depth (1–10, shown as a
  word — Fair/Light/Medium/Tan/Deep, **never a raw number**), an undertone (warm / cool / neutral /
  olive), and a flattering finish. A branded **share flow** (`ScanShareCard.tsx` +
  `use-scan-share.ts`) captures the derived-shade card only — never the photo — to the native share
  sheet.
- **Match boundary** (`src/features/match/`) — a brand-neutral `product-catalog`, `scoring` that
  emits **only a compatibility fit % (40–99)** from shade proximity + undertone + the user's
  coverage/skip preferences, `fit-reason` (cosmetic-only "why it fits" lines), and `sort`/ranking.
- **Shop tab** (`app/(tabs)/shop.tsx`, `src/features/shop/ShopList.tsx`) — ranks the catalog
  best-first per person + filter tab (top card badged "Best match"); pre-scan it shows a neutral
  shelf with no fit signal. A `BagBar` (`src/features/checkout/`) appears once the bag has items and
  routes into checkout.
- **Setup preferences** (`src/features/preferences/` + `setup-ui/`) — structured (non-free-text)
  Setup answers: goals (multi), coverage (single), skips (multi). `session/personalization` holds the
  derived shade for the session (descriptors only, never the image).
- **Makeup vocabulary** (`src/content/makeup-vocab.ts`) — the single source of truth for makeup
  descriptors (goals / coverage / skips / finishes / undertones / categories / fit-reason fragments),
  **additive to and never widening** the frozen skin-read vocabulary. Every string is blocklist-clean.
- **Community + identity** (`src/features/community/`, `src/features/identity/`) — a Routines/Feed
  tab screen seeded from local data (no backend table, no network; media is a color-swatch
  placeholder, never a real image/video URL), plus a username/avatar identity seam on the Account
  screen (`community_profile` columns on `profiles`, migration `0021`; the database is the sole
  username-uniqueness authority).
- **My Daily Routine** (`src/features/routine/`) — a separate concept from the older skincare-routine
  recommender in `recommend/`: an on-device AM/PM product logger that can **publish into the
  Community Routines feed** with one tap. See
  [`docs/COFOUNDER_HANDOFF.md`](docs/COFOUNDER_HANDOFF.md#routines-my-daily-routine--task-13-new-this-release)
  for the exact file map — these two "routine" concepts are easy to conflate.
- **For You** (`app/(tabs)/index.tsx`) — greeting + affirmation + two ranked product rails
  (`src/features/foryou/`); the week strip and skin-feel diary that used to live here were removed
  this release.

For the exact file-by-feature map (which file to edit for a given change) and build-profile safety
notes, see [`docs/COFOUNDER_HANDOFF.md`](docs/COFOUNDER_HANDOFF.md). The architecture and full
module map live in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App shell | Expo SDK 56 (RN 0.85, React 19, New Arch), Expo Router, NativeWind, TypeScript |
| Design system | "Mist" liquid glass — `expo-blur` + `expo-linear-gradient`, Fraunces + Mulish (`@expo-google-fonts`), `react-native-reanimated` |
| Auth | `@supabase/supabase-js` v2 — **anonymous-first** (stable user id from launch) |
| Capture | `react-native-vision-camera` v5 (+ `-face-detector`, `react-native-nitro-image`) — guided front-camera + quality gate |
| On-device read | `CvReadEngine` — classical computer vision, fairness-instrumented on a synthetic tone self-test (device-only decode shell; `react-native-executorch` shell reserved for a future ML model) |
| Dev/CI builds | EAS Build (`eas.json`: development / preview / production; Android dev build = arm64-v8a APK) |
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
  (tabs)/                tab nav (Shop · For You · Community · Account) w/ floating glass tab bar
    shop.tsx             Makeup shop shelf — the landing tab (initialRouteName)
    index.tsx            For You: greeting, affirmation, ranked product rails, routine summary widget
    community.tsx        Community tab route wrapper (renders CommunityScreen, no props)
    you.tsx              Account: skin profile, username/avatar, My Daily Routine logger, version marker,
                         links to Data Rights & Policies
  age-gate.tsx           18+ gate (native date picker + local one-time verification cache)
  consent.tsx            Biometric consent
  data/index.tsx         "Your Data" (withdraw / delete / account)
  policies/              Policy list + dynamic policy reader
  region-blocked.tsx     Not-available-in-region screen
  scan-gate.tsx          Pre-scan on-device-privacy reassurance (pushed from the For You header camera icon)
  scan/                  capture → result (shade share flow) → routine (P2 + steps 6–7)
  setup/                 makeup Setup wizard (goals → coverage → skips)
  routine.tsx            Skincare-routine + scoped chat entry (the OLDER `recommend/` routine, not "My Daily Routine")
  checkout.tsx           Mock checkout screen (BagBar entry point)
  paywall.tsx            TrueTone Plus pricing shell (no StoreKit)
  (dev)/                 dev-only routes
src/
  lib/                   supabase client, anon auth, region check, routing guard, profile context, scans client,
                         app-version (native version/build label)
  components/ui/         "Mist" glass primitives (MistBackground, Screen, GlassCard, GlassSheet, Button,
                         AppHeader, TextField, Typography, GlassTabBar, ListRow, SectionLabel,
                         use-responsive foldable sizing)
  theme/                 design tokens (palette, type, glass, Fitzpatrick scale)
  features/
    age-gate, consent, data-rights, onboarding, policies   (P1; reskinned as glass)
    capture/             guided camera + quality gate + auto-capture controller (device-only shell)
    read/                CvReadEngine (classical CV) + cv/ dimensions, image lifecycle, bands, dormant executorch shell
    recommend/           deterministic SKINCARE routine engine, skincare library, RoutineView, scoped chat
                         (distinct from features/routine/ below)
    today/               daily affirmation (pure, on-device wellness copy); WeekStrip module still exists
                         but is no longer rendered on For You
    diary/               skin-feel mood picker + on-device AsyncStorage — module exists, no longer rendered
                         on For You; still purged by delete-everything if reachable elsewhere
    age/                 within-user trend card + skin-age engine (absolute gated dark by age-flags)
    feedback/            "did this help?" routine-feedback prompt (step 7)
    premium/             display-only entitlement seam (RevenueCat deferred; no biometric data)
    personalize/         per-user baseline (median+MAD) + "compared to your usual" copy; emphasizes routine (step 8)
    checkout/            BagBar + bag-store — Shop → mock checkout entry point
    ── makeup shade-match, shop, social (shipped this release) ──
    shade/               deriveShade() read→foundation shade (depth/undertone/finish), ShadeMatchResult,
                         ScanShareCard + use-scan-share (branded share flow, derived descriptors only)
    match/               match-types, scoring (fit % 40–99), product-catalog, fit-reason, sort/ranking
    shop/                ShopList shelf + ProductCard + FilterTabs + shelf-store (in-memory saved items)
    preferences/         structured Setup answers (goals/coverage/skips) + preferencesStore
    setup-ui/            pure Setup toggle helpers (goal-selection, skip-selection)
    session/             per-session personalization store — derived shade only, never the image
    schedule/            in-memory routine-schedule store (no notifications this phase)
    today-home/          Today-style cards (seasonal report, picked-for-you, shade-twins, …) — props-only
                         shells; no `app/` references yet
    foryou/              For You product rails + pre-scan card (for-you-profile, ProductRail, FindYourShadeCard)
    identity/            CommunityProfile seam — username/avatar validation, repository, hook (migration 0021)
    community/           Community screen, seed data, feed hook, post/routine cards (local-only, no backend)
    routine/             "My Daily Routine" — on-device AM/PM product logger + one-tap publish into
                         Community (distinct from recommend/'s skincare routine)
  content/               policy manifest (version source of truth) + markdown/bodies; makeup-vocab.ts (shade-match descriptors)
supabase/
  migrations/            0001 schema → 0021 profile identity (scans, RPCs, backup purge, routine, skin-age,
                         username/avatar)
  functions/             routine-chat Edge Function (+ _shared compliance copies)
  tests/                 pgTAP suites (RLS, consent immutability, RPCs, retention, scans)
scripts/                 check-no-analytics-sdk.mjs + check-no-image-egress.mjs (CI guards)
eval/                    fairness-eval dev tool (Fitzpatrick metrics; host/CI only, never bundled)
test/                    Jest setup + node:test integration (gate-flow, scans)
docs/                    architecture + ops checklists + superpowers plans/specs + COFOUNDER_HANDOFF.md
data/                    compliance spec PDFs (source of truth, not shipped)
```

> **Navigating a feature?** [`docs/COFOUNDER_HANDOFF.md`](docs/COFOUNDER_HANDOFF.md) turns this
> tree into a task-oriented map ("I want to change the Shop ranking / add a Community feature /
> touch the design system — which files?") plus build-profile safety notes and verified test
> commands per area.

---

## Getting started

### Prerequisites

- Node 22+ (`@supabase/realtime-js` requires native `WebSocket`, which lands in Node 22)
- Docker (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase` works)
- A physical device (Android today; iPhone once Apple Org enrollment lands) + an Expo dev build for
  any camera / on-device-read work — simulators have no camera and can't load the vision-camera /
  Executorch native modules. See [Build a dev client](#build-a-dev-client-eas).

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

The app now ships custom native modules (vision-camera, nitro-image, blur/gradient), so **Expo Go
can no longer load it** — you need a development build (below). Once a dev build is installed on a
device/emulator, start the bundler with the dev client:

```bash
npx expo start --dev-client   # then open the app from your dev-build device
```

### Build a dev client (EAS)

Native code (camera, on-device read, glass blur) runs only in a development build. Profiles live in
[`eas.json`](./eas.json):

```bash
npm i -g eas-cli            # or use npx eas-cli
eas login
eas build -p android --profile development   # internal APK; arm64-v8a only (physical devices)
eas build -p ios     --profile development   # requires the Apple Developer Organization (see docs/ops)
```

When the build finishes, install it:

```bash
eas build:run -p android --latest            # install to a connected device/emulator
```

> iOS builds run in EAS cloud and need the company **Apple Developer Organization** enrollment
> (LLC + D-U-N-S) — see [`docs/ops/apple-org-enrollment-checklist.md`](./docs/ops/apple-org-enrollment-checklist.md).
> The Android dev build is restricted to `arm64-v8a` (real devices) to cut native compile time;
> re-add other ABIs in `app.json` if you target 32-bit devices or x86 emulators.

---

## Testing & checks

```bash
npm test                 # Jest unit/component tests (app/src + eval harness; coverage gate enforced)
npm run test:coverage    # with coverage (Jest global gate: 80% lines/stmts/funcs, 70% branches)
npm run test:integration # node --test against a running local Supabase (gate-flow + scans E2E)
npm run test:scripts     # node --test for the compliance scripts (Jest only collects .ts/.tsx)
npm run check:compliance # fails if any ad/analytics SDK is present
npm run check:no-egress  # fails if the raw image could reach a network/log sink
npx supabase test db     # pgTAP suites (RLS isolation, consent immutability, RPCs, retention, scans)
```

CI ([`.github/workflows/compliance.yml`](.github/workflows/compliance.yml)) runs
`check:compliance` + `check:no-egress` + `npm test` + `test:scripts` on every push and PR.
Integration and pgTAP tests need a live Supabase and run separately.

---

## Website (`web/`) — **live at https://truetone-1rw.pages.dev**

A static pre-launch landing page and isolated `/shop` on the app's own Mist palette, deployed to Cloudflare Pages. The landing page
collects an email and an 18+/US attestation — **no biometric or skin data**, so it sits entirely
outside the compliance boundary — and stores them in Supabase via the `join_waitlist` RPC
(migrations `0014_waitlist.sql`, `0015_waitlist_service_read.sql`). The Shop uses Shopify's public
Storefront API for approved products, a guest cart, and checkout handoff. It receives no scan,
score, shade, profile, routine, chat, or recommendation data.

```bash
npm run waitlist:build      # renders policies, subsets fonts, writes config.js and _headers
npx wrangler pages deploy web --project-name=truetone --branch=main
```

`waitlist:build` needs the two `EXPO_PUBLIC_SUPABASE_*` values plus
`EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN`, `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`, and
`EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS` in the environment. The Storefront token is public by design
but remains build-injected for rotation; never put an Admin or private token here. `pyftsubset`
(`pip install fonttools brotli`) is only needed when changing a
typeface — the subsets in `web/fonts/` are committed, so a deploy box needs neither Python nor
`node_modules`.

**`web/` contains exactly what gets deployed.** Tests live in `test/web/`, not inside it, because
Cloudflare Pages serves every file in the output directory (`.assetsignore` is not honoured for
direct upload). Policy pages are rendered from `src/content/*.md` — **edit the markdown, never
`web/policies/`** — so the site and the app can never state different terms.

Two things keep the page honest, and both fail the build rather than relying on discipline:

- `scripts/check-waitlist-copy.mjs` (part of `check:compliance`) rejects disease names, treatment
  and cure claims, unbacked accuracy/equity claims and bare `%` stats; permits disclaimer wording
  only in a sentence that negates or redirects to a clinician; and rejects **any** third-party
  origin, which is why the fonts are self-hosted rather than loaded from Google.
- `anon` holds no table privileges on `waitlist` and RLS carries no policies, so the list can be
  written to and never read. `join_waitlist` and `leave_waitlist` both return void, so neither can
  be used to test whether an address is on the list. Only `service_role` (server-side, never in the
  browser bundle) may read it, and it cannot delete — removal goes through `leave_waitlist` or the
  nightly retention sweep.

To read the list for sending invites, use the `service_role` key or the dashboard SQL editor.

---

## Roadmap

Build order (P1 first — biometric compliance cannot be retrofitted):

1. ✅ 18+ age gate (neutral DOB)
2. ✅ Standalone biometric consent + consent logging
3. ✅ Data-rights screens (withdraw / delete-everything / account deletion)
4. ✅ Privacy / Terms / Biometric / Retention / WA-health policies reachable before scan
5. ✅ Guided capture + real classical-CV on-device read → cosmetic scores *(runs end-to-end on an
   Android dev build; vision-camera worklet quality metrics + a full physical-device verification
   pass + iOS are the open work)*
6. ✅ Brand-neutral routine + scores-only "why this" chat
7. ✅ Progress re-scan + honest within-user trend + "did this help?" feedback

Shipped (`release/tt-r1-unified`):

- ✅ **Makeup shade-match, shop & community** — on-device read → foundation shade (depth /
  undertone / finish) → brand-neutral product fit % → shoppable shelf, a structured Setup wizard, a
  scan-share flow, a Community feed with a user routine-logger, and a username/avatar identity seam.
  **Wired and navigable** — Shop is the landing tab; Community replaces the old Trend tab. See
  [What's built → Makeup shade-match, shop & community](#makeup-shade-match-shop--community-shipped)
  and [`docs/COFOUNDER_HANDOFF.md`](docs/COFOUNDER_HANDOFF.md).

Gated / dark (built, awaiting sign-off — not user-visible):

- ⏳ Absolute "skin age" number — engine built, **triple-gated OFF** until validation data + legal
  sign-off (accuracy claim, FTC §5 / ICFA).
- ⏳ Premium billing (RevenueCat) — entitlement seam only; adapter deferred.

Parallel tracks:

- ✅ "Mist" liquid-glass design system — shared glass primitives + tokens; every non-camera screen
  reskinned (presentation-only; compliance copy + guards unchanged).
- ✅ Fairness-eval harness — balanced Fitzpatrick I–VI labeling + per-group metrics, now wired to the
  real CV read via a synthetic tone-invariance self-test (still synthetic — real-data validation is
  gated on counsel-approved images; no equity claim ships from synthetic results).

Designed / next (approved direction, **not yet built** — specs in `docs/superpowers/`):

- 📐 **Per-user personalization** ("it learns from you") — learn each user's per-dimension *personal
  normal* from their own scan history and frame the latest read **relative to their own baseline** +
  emphasize the routine steps most off that baseline. **Within-user/relative only** — it does *not*
  re-scale the displayed 0–1 scores, so no new compliance gate. Spec + 8-task TDD plan on file.
- 📐 **Trained on-device model track** — replace the heuristic `CvReadEngine` (`cv-1`) with a neural
  model **trained offline by us** on a consented/licensed dataset (never on users' images), shipped
  as fixed ExecuTorch `.pte` weights running on-device, and **tone-fairness-validated on the existing
  harness before it becomes the default**. **HARD-GATED** on a consented/licensed dataset + founder/
  legal sign-off (`CLAUDE.md` §6) — no training, and no user data, without it.

Plans and specs: [`docs/superpowers/`](./docs/superpowers/).

---

*Engineering/compliance guidance current to mid-2026 — **not legal advice**. A licensed Illinois
privacy/biometric attorney reviews before public launch. Policy bodies in `src/content/` are
placeholders pending counsel review (the Biometric Data Policy carries the mandatory BIPA §15(b)
summary inline).*
