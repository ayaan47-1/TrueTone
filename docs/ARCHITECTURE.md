# TrueTone Architecture & Codemap

> Reflects what has landed on `main`: the **P1 compliance scaffold**, the **P2 capture +
> on-device-read pipeline** (shipped read = **classical computer vision**, `CvReadEngine`), the
> **brand-neutral routine + scores-only chat** (build-order step 6), the **"Mist" liquid-glass
> design system**, the **progress-trend + "did this help?" loop** (step 7), and the **fairness-eval
> dev tool** (migrations `0001`–`0012`, all modules below).
> The device-gated pieces are the native JPEG decode + the worklet-backed quality metrics; an
> `ExecutorchEngine` ML shell exists but is **dormant** (never instantiated — reserved for a future
> model). Source of truth for *rules*: [`../CLAUDE.md`](../CLAUDE.md). This doc maps *what exists*.

## The compliance boundary

```
ON DEVICE  →  capture → quality gate → on-device read → cosmetic scores + routine
                                  (raw image deleted here — never logged, never uploaded)
──────────────── compliance boundary: only derived scores cross ────────────────
BACKEND    →  Supabase (auth, consent log, scans, retention) + routine-chat Edge Fn → Claude (scores only)
```

The **face image lives and dies on the phone**: capture hands a file URI to the read, the read
derives scores and **deletes the image** (success or failure), and only the derived `ScoreVector` +
skin-type + routine ever cross to Supabase. The routine-chat Edge Function receives band labels +
routine text — never the image, never raw scores presented as medical fact. Two CI guards enforce
this statically: `check-no-analytics-sdk.mjs` (no ad/analytics SDK) and `check-no-image-egress.mjs`
(no image→network/log path).

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
`useProfile()` and **navigates imperatively** (never renders `<Redirect>` in place of the `<Stack>` —
that remount-loops `ProfileProvider`) based on the computed `route`:

| State | Screen | Route file |
|-------|--------|-----------|
| loading | spinner | `_layout.tsx` |
| error | error message (never advances to home) | `_layout.tsx` |
| `region-blocked` | not available in your region | `region-blocked.tsx` |
| `age-gate` | 18+ DOB entry | `age-gate.tsx` → `features/age-gate/AgeGate` |
| `consent` | biometric consent | `consent.tsx` → `features/consent/Consent` |
| `home` | **Today dashboard (tab nav)** | `(tabs)/index.tsx` |

`home` resolves to the **`(tabs)` group** (`(tabs)/index.tsx` → path `/`, so the gate redirect is
unchanged). A **floating glass tab bar** (`GlassTabBar`, custom `tabBar` prop — the default bar
can't render glass) carries five items: **Today · Routine · ⊙ Scan · Trend · You**. The center
**Scan** is a button that `router.push('/scan')` (the camera stays a full-screen route, not a tab).

| Tab | Screen | Surfaces |
|-----|--------|----------|
| Today | `(tabs)/index.tsx` | week strip, today's-routine summary, skin-feel diary, daily affirmation, disclaimer |
| Routine | `(tabs)/routine.tsx` | latest routine (`RoutineView`) + scoped chat entry |
| Trend | `(tabs)/trend.tsx` | within-user trend (`AgeTrendCard`, flag-gated skin-age) + recent-reads timeline |
| You | `(tabs)/you.tsx` | skin profile + `ListRow` links to **Data Rights** (`/data`) and **Policies** (`/policies`) |

This surfaces what were previously **orphaned** screens (Routine, chat, Data Rights, Policies — built
but unreachable). The standing cosmetic disclaimer that lived on the old onboarding entry now renders
in the Today footer (and You). `policies/index.tsx` (list) and `policies/[doc].tsx` (reader) remain
always-reachable; `data/index.tsx` ("Your Data") is reached from the You tab.

Behind the gates, the scan flow lives under `app/scan/`: `index.tsx` (guided capture) →
`result.tsx` (fetch latest scan, render the dimension-list read; "Scan again" + feedback render
inside the scroll via `Result`'s `footer` slot). The routine is also reachable as a tab.

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

### Scan pipeline — `capture/` + `read/` (P2)

All real logic is **pure and Jest-tested**; the camera and native inference are thin shells marked
`// DEVICE-ONLY` (not runnable under Jest or the Simulator — verified in an Expo dev build).

| Module | What it does | Compliance-critical behavior |
|--------|--------------|------------------------------|
| `capture/quality-gate.ts` | `evaluateQuality(metrics)` → pass/fail per face/light/framing/focus | pure; blocks capture until steady |
| `capture/face-metrics.ts`, `luma-metrics.ts` | Derive face presence/centering/distance + brightness/sharpness | pure metric math over frame signals |
| `capture/capture-controller.ts` | Auto-capture reducer (steady → 3-2-1 countdown → fire) | pure state machine |
| `capture/use-frame-metrics.ts`, `Capture.tsx` | vision-camera v5 wiring + guided UI | **device-only shell**; URI handed to read **only**, never logged/uploaded |
| `read/run-read.ts` | Orchestrates the live read: `new CvReadEngine().run(uri)` → persist scores | wires capture → engine → `record_scan`; image deleted inside the engine |
| `read/read-engine.ts` | `ReadEngine` interface (no native dep) | pure contract — both engines implement it |
| `read/cv-read-engine.ts` | **Shipped engine** — classical CV: decode → detect bbox → `scoreFromRgb` | runs inside `withImageCleanup`; **no network, no ML model**; `isStub: false` |
| `read/cv/score-from-rgb.ts` | Core inference: 8 cosmetic dimensions from pixels | pure; Laplacian texture energy, CIELAB (`color.ts`) deltas vs a per-face skin baseline |
| `read/cv/dimensions/*.ts` | One pure function per dimension (hydration, oiliness, texture, pores, darkSpots, redness, fineLines, darkCircles) | pure; baseline-normalized so the read holds across tones |
| `read/cv/{sampling,regions,baseline,color,calibration,skin-type}.ts` | Region sampling, color-space math, calibration, skin-type classify | pure; Jest-tested |
| `read/decode-rgb.ts`, `detect-bbox.ts` | Native JPEG decode + face bbox | **device-only shells** (the only non-host part of the CV path) |
| `read/image-lifecycle.ts` | `withImageCleanup` — `try/finally` + retries | **deletes image on success OR failure**; cleanup never throws |
| `read/bands.ts` | Numeric score → cosmetic **band label** | pure; non-diagnostic vocabulary only |
| `read/stub-read.ts`, `run-stub-read.ts` | Deterministic placeholder scores (`isStub: true`) | **`__DEV__` web/Expo-Go preview only**, where native decode is unavailable — never the device read |
| `read/executorch-engine.ts`, `preprocess.ts`, `decode-output.ts` | **Dormant** ML shell (`react-native-executorch`) + its tensor/`[1,12]` helpers | **never instantiated**; native calls `throw`; reserved for a future model swap behind `ReadEngine` |
| `read/Result.tsx` | Dimension-list results screen | renders **bands only**, never diagnostic language |

### Recommendation + chat — `recommend/` (step 6)

| Module | What it does | Compliance-critical behavior |
|--------|--------------|------------------------------|
| `recommend/routine-engine.ts`, `skincare/{library,rules,domain}.ts` | Deterministic scores+type → routine | **on-device**; content drawn ONLY from the approved library |
| `recommend/RoutineView.tsx` | Renders the routine + cosmetic disclaimer | approved vocabulary only |
| `recommend/chat/refusal.ts` | Medical-query detector (mole/lesion/cancer/melanoma, inflections) | **hard-refuse → dermatologist referral; LLM never called** |
| `recommend/chat/prompt.ts` | Builds the Claude prompt from **band labels**, not raw scores | no image, no raw scores as medical fact |
| `recommend/chat/guard.ts` | Fail-closed output post-filter (reuses the cosmetic filter) | blocks any disease term before display |
| `recommend/chat/handle.ts` | Orchestration: refuse → load (RLS) → prompt → complete → guard | ephemeral; no transcript stored |
| `recommend/ChatScreen.tsx` | Scoped chat UI | scores-only context |

The deterministic chat logic lives in `src/`; the Edge Function imports byte-identical copies under
`supabase/functions/_shared/recommend/` — a drift guard test asserts the copies match.

### Trend + feedback + skin-age — `age/`, `feedback/`, `premium/` (step 7)

| Module | What it does | Compliance-critical behavior |
|--------|--------------|------------------------------|
| `age/skin-age-trend.ts`, `AgeTrendCard.tsx` | Within-user *relative* freshness/trend from stored scores + "Scan again" | no cross-user comparison; no validation gate (relative, not an absolute claim) |
| `age/skin-age-engine.ts` | `estimateSkinAge(read)` → absolute "looks like ~N" estimate | **gated dark**: returns `null` unless `SKIN_AGE_ABSOLUTE_ENABLED` (false); computed from the in-memory read, never the image |
| `age/age-flags.ts` | `SKIN_AGE_ABSOLUTE_ENABLED = false` | the absolute number is an accuracy claim — flipping it needs validation data + founder/legal sign-off (`CLAUDE.md` §1) |
| `feedback/RoutineFeedbackPrompt.tsx`, `types.ts` | "Did this help?" → `routine_helpful` (`helped`/`no_change`/`worse`) | written to the scan row via RPC; inherits RLS / delete / retention |
| `premium/entitlement.ts` | Display-only `hasAgeAccess()` boolean; `setEntitlementSource` seam for RevenueCat | **MUST NOT import scores/reads/image** — billing never sees biometric/health data |

`run-read.ts` also computes the (gated) skin-age in the same on-device pass as the read; only the
derived number (or `null`) is persisted via `record_scan`, never the image.

### Today dashboard + skin-feel diary — `today/`, `diary/`

The Today tab's content. The **skin-feel diary** is new user data; per `CLAUDE.md` it is stored
**on-device only** (no server table) and wired into delete-everything.

| Module | What it does | Compliance-critical behavior |
|--------|--------------|------------------------------|
| `today/week.ts` | `toDateKey`, `buildWeek`, `formatShortDate` — pure week-strip + date math | pure; no persistence |
| `today/WeekStrip.tsx` | Row of day pills, marking days with a scan; today highlighted | reads scan dates only |
| `today/affirmations.ts`, `AffirmationCard.tsx` | Rotating local affirmation (day-of-year) + Share | **pure wellness copy**, cosmetic vocabulary only; no data, no network |
| `diary/moods.ts`, `MoodPicker.tsx` | 5-face "how does your skin feel today?" row | **cosmetic wording only** (skin *feel*, never a condition) |
| `diary/diary-storage.ts` | `getMood`/`setMood`/`clearDiary` over AsyncStorage (single key `truetone.diary.v1`) | **on-device only**; `clearDiary()` is called from `delete_my_data`/`delete_account` in `DataRights` so the diary is purged with everything else |

### Design system — "Mist" (`components/ui/` + `theme/`)

A liquid-glass UI layer. Presentation-only: it changes how screens look, not what they assert —
all compliance copy and `testID`s are preserved, and no analytics/ad SDK is added (both CI guards
stay green).

| Module | What it does |
|--------|--------------|
| `theme/tokens.ts` | Design tokens — palette, type scale, glass/elevation, Fitzpatrick I–VI scale, sage/clay band tints |
| `components/ui/MistBackground.tsx` | `expo-linear-gradient` mist mesh backdrop |
| `components/ui/{GlassCard,GlassSheet}.tsx` | `expo-blur` frosted surfaces (the age gate + policy reader render as glass popups; the reader is a `transparentModal` route) |
| `components/ui/{Screen,Button,Typography}.tsx` | Layout shell + primitives (Fraunces + Mulish via `@expo-google-fonts`). `Screen` applies safe-area insets **additively** (`topGap`/`bottomGap`) and centers + caps content width on wide/unfolded screens |
| `components/ui/GlassTabBar.tsx` | Floating frosted pill tab bar (custom `tabBar`); exports `TAB_BAR_CLEARANCE` for screen bottom padding |
| `components/ui/{ListRow,SectionLabel,Disclaimer}.tsx`, `tab-icons.tsx` | Row link, centered divider label, standing cosmetic disclaimer, hand-drawn tab glyphs (no icon dependency) |
| `components/ui/use-responsive.ts` | Foldable-aware sizing (`useResponsive`, `clampContentWidth`, `captureOvalSize`, `bloomMetrics`); edge-to-edge is mandatory on SDK 56, so surfaces scale to the Galaxy Fold's folded + unfolded aspect ratios |

> The "tuned fairly for every tone" caption from the design is a skin-tone-equity claim gated on
> validation data (`CLAUDE.md` §1/§6); the Fitzpatrick I–VI tone strip ships with the **factual**
> "Fitzpatrick I–VI" caption instead.

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

The "purpose-met" deletion arm — deferred in P1 — is **closed by P2** (`0009`, below).

### Seed (`0006_seed_policies.sql`)

Seeds all five docs at `2026-06-15.1` as current (idempotent `on conflict do nothing`); mirrors
`manifest.ts`.

### Backup / PITR purge (`0007_backup_purge.sql`)

Closes the P1 spec §1 *verified backup/PITR purge* hard gate: documents and wires the cycle on which
deleted/de-identified data is purged from backups + point-in-time-recovery windows, so a delete is
truly final. See [`docs/compliance/pitr-purge.md`](compliance/pitr-purge.md).

### Scans (`0008_scans.sql`) — derived scores only, no image

Append-only `scans` table holding **only derived cosmetic scores** (eight `score_*` numerics in
`[0,1]`, `skin_type_feel`, `model_version`, `is_stub`) — never the image. RLS: clients can `select`
their own rows only; **all writes go through a `SECURITY DEFINER` RPC** (no client insert/update/
delete). Append-only by design so the future trend loop (step 7) needs no schema change.

### Scan RPCs + purpose-met retention (`0009_scan_rpcs_retention.sql`)

`record_scan(...)` (SECURITY DEFINER) validates and inserts a scan row for `auth.uid()`. This
migration also adds the BIPA §15(a) **purpose-met** retention arm deferred in `0005`.

### Routine (`0010_routine.sql`)

Adds `routine jsonb` + `routine_engine_version` to `scans` (routine is 1:1 with a scan — scores are
immutable, so the routine is stable), inheriting all existing RLS / retention / delete machinery.
Replaces `record_scan` with the 6-arg form that persists the routine atomically with the scores.

### Skin-age (`0011_skin_age.sql`)

Adds nullable `skin_age_estimate` (0–120) + `skin_age_confidence` to `scans` and extends
`record_scan` to an 8-arg form (two trailing nullable params). The absolute age stays `NULL` until
`SKIN_AGE_ABSOLUTE_ENABLED` is flipped (validation gate). Inherits scans RLS, the retention sweep,
and `delete_my_data()`.

### Routine feedback (`0012_routine_feedback.sql`)

Step 7 "did this help?": adds `routine_helpful` (`helped`/`no_change`/`worse`, checked) +
`feedback_at` to `scans`, captured via a `SECURITY DEFINER` RPC. No new retention/deletion code —
it rides the existing scans RLS, `delete_my_data`, retention sweep, and backup/PITR purge.

### Routine-chat Edge Function (`supabase/functions/routine-chat/`)

The only LLM/network piece. Loads the caller's scores + routine under RLS, short-circuits medical
queries to a dermatologist referral (Claude not called), builds a band-label prompt, calls Anthropic
(**`ANTHROPIC_API_KEY` is a server-side Edge Function secret — never in the app bundle**), and runs
every reply through the fail-closed cosmetic post-filter. Compliance modules are byte-identical
copies under `_shared/recommend/`, asserted by a drift-guard test.

### pgTAP tests (`supabase/tests/`)

| File | Verifies |
|------|----------|
| `schema.test.sql` | tables, PKs, composite FK enforcement |
| `rls_isolation.test.sql` | cross-user isolation; world-readable policies; RLS-enabled guard |
| `consent_immutable.test.sql` | UPDATE/DELETE on `consent_log` blocked (P0001) |
| `rpc_consent.test.sql` | `record_consent` idempotency + version pinning |
| `rpc_delete.test.sql` | derived data cleared, receipt logged, prior rows de-identified |
| `retention.test.sql` | stale user purged, active kept, run logged |
| `scan_rpcs.test.sql` | `record_scan` validates scores/shape, scopes to caller, persists routine |
| `skin_age.test.sql` | skin-age columns nullable + range-checked; `record_scan` 8-arg form scoped to caller |
| `routine_feedback.test.sql` | `routine_helpful` constrained values; feedback RPC scopes to caller; inherits delete |

---

## Compliance CI guards — `scripts/`

- **`check-no-analytics-sdk.mjs`** — `findForbidden(text)` scans `package.json`,
  `package-lock.json`, and Expo config for forbidden ad/analytics SDKs (Firebase Analytics,
  Meta/FB SDK, Segment, Google Mobile Ads, AppsFlyer, Amplitude, Mixpanel, Branch) and exits
  non-zero on any hit — the "GoodRx/BetterHelp/Flo trap" guard. (`npm run check:compliance`)
- **`check-no-image-egress.mjs`** — fails the build if a captured image URI could reach a network
  or log sink, enforcing that the raw image never crosses the compliance boundary. (`npm run
  check:no-egress`)

Both are wired into the `compliance` GitHub workflow. (`export_stub_model.py` builds the deep-stub
`.pte` model used by the read engine.)

## Fairness-eval dev tool — `eval/fairness/`

A standalone harness, **never imported by `app/` or `src/` and never shipped**. Pure metric modules
consume `Observation[]` (Fitzpatrick FST + subjectId + quality-gate report + scores); a runner
produces observations from a manifest via an **injected extractor**. Two extractors exist today,
both **synthetic** — the real image→read adapter (decode a consented image → run `CvReadEngine`) is
gated on counsel-approved data.

| Module | Verifies / does |
|--------|-----------------|
| `fst.ts`, `types.ts` | Fitzpatrick I–VI scale + `Observation`/`zod` manifest schema (FST + consentRef required) |
| `gate-parity.ts` | quality-gate pass-rate parity across Fitzpatrick groups |
| `stability.ts` | intra-subject score-stability parity across groups |
| `bias.ts` | systematic bias — Pearson corr(Fitzpatrick, score) per dimension, with a practical-significance effect floor |
| `thresholds.ts`, `metrics.ts`, `report.ts` | provisional (policy-owned) thresholds → fail-closed verdict → aggregate-only `FairnessReport` (md + json) |
| `run-eval.ts` | manifest + injected extractor → `Observation[]` → report |
| `run-fixtures.ts` | deterministic synthetic observations (no faces) — CI smoke |
| `self-test-images.ts`, `cv-extractor.ts` | procedurally renders the **same** blemishes on each Fitzpatrick tone, runs the real `scoreFromRgb` over them → a **tone-invariance self-test** of the CV algorithm (still synthetic — proves the algorithm, not real-world fairness) |

Compliance by construction: raw eval images never enter git or production Supabase (`eval/data/` is
gitignored — it holds only a README; a guard test enforces "no images tracked under `eval/`"); only
aggregate reports are committed. The harness **reports** numbers and verifies the algorithm is
tone-invariant on synthetic faces — it does **not** certify real-world fairness, and per spec §9 **no
equity claim ships from synthetic results**.

## Test topology

- **Unit/component** — Jest (`jest-expo`) + RTL 14. RTL 14's `render`/`fireEvent` are **async**.
  `app/_layout.tsx`/`profile-context` covered via route-wrapper + integration tests.
- **Integration** — `node --test test/integration/**/*.test.mjs` (jest-expo breaks `supabase-js`'s
  `fetch`; plain Node works). Needs a running local Supabase. Excluded from the default jest run.
- **DB** — pgTAP via `npx supabase test db`.
