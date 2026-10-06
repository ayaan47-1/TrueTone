# CLAUDE.md — TrueTone build guardrails

> **Read this on every task.** TrueTone is a makeup discovery and preference-based skincare app.
> It helps adults explore makeup shades and build cosmetic routines around their stated
> preferences. It does not provide medical advice, assess skin health, or diagnose or treat conditions.
> **Makeup + preference-based skincare is the governing product scope**, not just a disclaimer.
>
> **Scope update (2026-10-04):** read [AGENTS.md §0](./AGENTS.md#0-the-governing-principle-everything-flows-from-this)
> for the authoritative product boundary, canonical description and Illinois launch-evidence
> requirements. These narrow the older build summaries below. Scan-driven skincare selection,
> measured-finish claims and unvalidated match percentages described below are legacy behaviour
> to migrate or gate, not authorization to ship. This documentation update is not a runtime
> migration or legal certification. No existing privacy or consent safeguard is relaxed.
>
> **Current build (2026-10-06):** the makeup shade-match and preference-based skincare layer is
> **landed and wired** on `main`. The app opens to a four-tab Liquid Glass shell (**Home · Shop · Community · Account**),
> landing on **Home** (`index`). The on-device shade read feeds a brand-neutral catalog emitting
> qualitative match tiers (e.g. "Exact match", "Great match", "Good match"). Local user data is
> encrypted at rest via AES-256-GCM (`@noble/ciphers` + SecureStore). See §5 for build status.
>
> These are hard engineering + compliance rules, derived from the project's legal spec. They are
> **not legal advice**; a licensed Illinois privacy/biometric attorney reviews before launch. Do
> not relax any rule below to make a task easier. If a request conflicts with a rule, STOP and
> flag it (see "Escalate, don't improvise").
>
> **Keyword convention (RFC-style):** `MUST` = hard requirement / launch blocker ·
> `MUST NOT` = prohibited, creates legal exposure · `SHOULD` = strong recommendation.
>
> **Build context:** Company in Illinois, USA · **iOS-primary** · **US-only for v0** · **18+ only.**

---

## 0. The governing principle (everything flows from this)

Intended use is reflected in functionality, UI, marketing and model outputs, not just a disclaimer.
These are requirements to implement and verify, not an assertion that every legacy path conforms:

1. Describe how skin **LOOKS** — its tone, undertone, and appearance — and match cosmetics to it.
   Never state or imply a medical diagnosis. (No raw read dimension is shown as a number; shade
   depth is rendered qualitatively, e.g. "Medium Warm.")
2. Match **brand-neutral makeup** and offer **preference-based cosmetic skincare**. Skincare
   selection must use explicit user preferences, not scan-derived scores or inferred skin type.
   Finish and coverage are preferences. Never claim to treat / cure / prevent disease or change
   skin structure/function. OTC availability alone does not make a product a cosmetic.
3. For a user's medical question or concern, **redirect to a qualified clinician — never assess it**.
   Do not imply that the camera screens for medically concerning findings.

If a feature request would break any of these, STOP and escalate to the founders.

---

## 1. Non-negotiable guardrails (MUST / MUST NOT)

### Language & claims
- **MUST** constrain every analysis/chat model via system prompt + output schema + a post-filter so
  it can ONLY emit approved cosmetic descriptors (hydration look, oiliness, texture, pores,
  appearance of dark spots / redness / fine lines / dark circles; skin type dry/oily/combination/
  sensitive-feeling).
- **MUST** hard-blocklist disease names and diagnostic phrasing from ALL user-facing output
  (e.g. acne, rosacea, eczema, melasma, dermatitis, skin cancer, melanoma).
- **MUST** hard-refuse any mole / lesion / "cancer" / "melanoma" assessment → return the
  dermatologist-referral message, regardless of how the user phrases it.
- **MUST NOT** output a disease diagnosis, or claim to treat / cure / prevent / heal / "clear up" a
  condition, or claim to change skin structure/function ("boosts collagen", "repairs barrier").
- **MUST NOT** ship any accuracy / efficacy / skin-tone-equity claim ("validated across every skin
  tone", "dermatologist-level", "clinically proven", a "%" stat) **without backing validation data
  on file.** Unsubstantiated claims = FTC §5 + Illinois ICFA exposure.

### Biometric & data (Illinois BIPA + WA MHMDA + PIPA)
- **MUST** keep the **raw face image on-device**: analyze locally, then delete it immediately after
  the read. The image MUST NOT be uploaded, logged, cached to a server, or sent to any third party.
- **MUST** show a standalone **biometric consent screen before the first scan**, with explicit
  opt-in, and **log consent** (user id, timestamp, policy version). No pre-checked boxes.
- **MUST** enforce an **18+ age gate (neutral date-of-birth entry) before the camera mounts.** No
  face data is captured, processed, or stored for anyone under 18.
- **MUST** publish a retention schedule and run an **automated deletion job**: destroy data when its
  purpose is met OR within **3 years of the user's last interaction**, whichever is first.
- **MUST** provide in-app **"Your Data" (view) + one-tap delete-everything + full account deletion**
  (deletion purges derived data and backups on a defined cycle).
- **MUST** encrypt in transit (TLS) and at rest.
- **MUST NOT** sell, lease, trade, or otherwise profit from biometric/health data, ever.
- **MUST NOT** share biometric/health data with any third party without separate consent.
- **MUST NOT** embed Firebase Analytics, Meta Pixel/SDK, or ANY ad/analytics SDK that can touch face
  images, skin data, scores, or health inferences. (This is the exact trap that fined GoodRx /
  BetterHelp / Flo.) *Enforced in code:* `scripts/check-no-analytics-sdk.mjs` (`npm run
  check:compliance`) fails the build/CI if any such SDK reaches deps or Expo config.

### Scope gates
- **MUST** keep v0 **US-only** (geo-restrict; defer GDPR).
- **MUST NOT** collect, request, or process any **DNA / genetic data** in any release until a
  GIPA-compliant authorization flow + legal review exist. (Illinois GIPA = higher damages than BIPA;
  it is a hard gate on the future DNA feature, not a v0 task.)

---

## 2. Tech stack (use these; don't substitute silently)

- **App shell:** Expo (SDK 56) + React Native + TypeScript · Expo Router · NativeWind for styling.
- **Dev/test workflow:** prototype non-camera screens in **Expo Go**; switch to an **Expo
  development build** (`expo-dev-client` + EAS Build) the moment camera or on-device ML is added —
  Expo Go cannot load custom native modules.
- **Capture:** `react-native-vision-camera` (v5) for guided capture + lighting/framing quality gate.
  Use the **standard camera (selfie photo)** — **MUST NOT** use TrueDepth/ARKit face-mesh APIs
  (extra Apple restrictions, no MVP benefit).
- **On-device read:** `react-native-executorch` (preferred) or `onnxruntime-react-native`. Requires
  the New Architecture (default in SDK 56). The read runs here; the image never leaves the device.
- **Shade match (on-device, pure):** the derived read (tone lightness / warmth / olive / oiliness /
  skin-type) maps to a **makeup shade** (depth + undertone + finish) and, with the user's structured
  Setup preferences (goals / coverage / skips), scores a brand-neutral product catalog into
  **qualitative match tiers** ("Exact match", "Great match", "Good match") for a shoppable shelf. This
  is a pure, deterministic mapping — it consumes **only the already-derived read descriptors, never the image**,
  and no raw read dimension is shown as a number; shade depth is rendered qualitatively (see §3). Makeup
  descriptors live in `src/content/makeup-vocab.ts`, additive to — and never widening — the frozen
  skin-read vocabulary.
- **Recommendation + chat:** a cloud LLM called from OUR backend, fed **only derived scores + skin
  type — never the image.** Output post-filtered against the disease blocklist (see §1).
- **Backend / data:** **Supabase** (Postgres + Auth + Row-Level Security + Storage + Edge Functions
  + `pg_cron`), **US region.** RLS isolates each user's rows; consent and 18+ profile flags are locked
  behind `SECURITY DEFINER` RPCs (migration 0026); auth sessions and on-device user data are encrypted
  at rest (AES-256-GCM via `@noble/ciphers` + `expo-secure-store`); `pg_cron` runs the retention/deletion
  job; an append-only table holds the consent log.
- **Crash reporting (optional):** only a tool configured to scrub PII and never attach images
  (e.g. Sentry with PII scrubbing). No product-analytics SDK on the scan path.
- **Payments (later, not MVP):** RevenueCat for subscriptions. Does not touch face data.
- **Build/ship:** EAS Build + EAS Submit + EAS Update (OTA for JS-only changes).

---

## 3. Architecture rule: the compliance boundary

There is one boundary that MUST hold:

```
ON DEVICE  →  capture → quality gate → on-device read → cosmetic scores
                                  (raw image deleted here)
─────────────────── compliance boundary: only derived scores cross ───────────────────
BACKEND    →  Supabase (auth, consent log, scores, retention) + LLM routine/chat (scores only)
```

- The **face image** lives and dies on the phone.
- Only **derived cosmetic scores / labels** (not the image) may cross to the backend.
- The **recommendation/chat LLM** receives scores + skin type, never the image.
- **Shade match runs entirely on-device, inside this boundary:** shade derivation and product
  scoring consume **only the already-derived read descriptors** (tone / warmth / olive / oiliness /
  skin-type) — never the image, a URI, or bytes — and no raw read dimension is ever rendered as a
  number (shade depth is shown as a word; product matches are qualitative tiers, not raw percentages).
- Layer separation is load-bearing — do not "temporarily" send the image to the server for
  convenience, even behind a flag.

---

## 4. iOS specifics (we are iOS-primary)

- **MUST** enroll the company as an Apple Developer **Organization** (not Individual) — required for
  sensitive-data apps. This needs an **LLC + D-U-N-S number**; start it early, it gates all iOS
  testing (TestFlight, device builds) and can take a couple of weeks.
- The **iOS Simulator has no camera** → the scan flow MUST be tested on a **physical iPhone**.
  Real-device testing is the default for anything camera-related, from day one.
- **MUST** provide specific camera/photo **permission purpose strings** (vague strings get rejected
  at review). Use the project's approved strings.
- App Review treats a face/skin app under the medical-apps guideline → present as cosmetic/wellness,
  never diagnostic. The following are part of passing review, not optional: in-app account + data
  deletion, truthful App Privacy "nutrition labels", and ATT only if anything tracks across apps
  (our minimize-everything approach is designed to avoid the ATT prompt).
- iOS builds run in EAS cloud; a Mac is only needed for the local Simulator or native debugging.

---

## 5. Build order (P1 first — this de-risks fastest)

Build and test in this sequence. Wiring consent + deletion BEFORE the camera exists is the whole
point — biometric compliance cannot be retrofitted.

1. ✅ 18+ age gate (neutral DOB) — *Expo Go OK*
2. ✅ Standalone biometric consent screen + consent logging — *Expo Go OK*
3. ✅ Data-rights screens: "Your Data" view + delete-everything + account deletion — *Expo Go OK*
4. ✅ Privacy Policy / Terms / Biometric Data Policy reachable before the scan — *Expo Go OK*
5. ✅ Guided capture + on-device read → cosmetic scores — *dev build + real iPhone* (code landed; on-device verification of the camera + Executorch native shells is the open work)
6. ✅ Brand-neutral routine + "why this product" chat (scores only) — *dev build*
7. ✅ Progress re-scan + honest trend + "did this help?" loop — *dev build* (PR #16; the absolute
   skin-age number is built but **dark** behind `SKIN_AGE_ABSOLUTE_ENABLED=false` until validation +
   founder/legal sign-off)

> **Status (2026-06-26):** Steps 1–7 are implemented, tested, and merged to `main` (step 7 = PR #16:
> within-user trend + "did this help?" loop + a dark absolute-age engine). The scan pipeline's pure
> logic is host-tested; the camera + on-device-read native shells (marked `// DEVICE-ONLY`) still
> need on-device verification in an Expo dev build on a physical iPhone. The fairness-eval harness
> (parallel track) is merged. Architecture + module map:
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); setup/run/test: [`README.md`](README.md);
> phase plans/specs: `docs/superpowers/`.

### Makeup shade-match & preference-based skincare (shipped)

The makeup shade-match and preference-based skincare layers have shipped and are wired on `main`:

- **Navigation:** four tabs in Liquid Glass UI — **Home · Shop · Community · Account**
  (`app/(tabs)/_layout.tsx`, landing on Home `index`). Native iOS 26+ tabs via `expo-router/unstable-native-tabs`
  with Quiet Glass floating blur bar on earlier platforms.
- **Scan flow:** The shade scan is a camera glyph in the Home header that pushes `/scan-gate` (on-device
  privacy reassurance) → the full-screen camera route, outside the tab navigator.
- **Match engine:** Pure on-device scoring against a brand-neutral catalog; emits qualitative match tiers
  ("Exact match", "Great match", "Good match"), not numeric percentages.
- **Security & Storage:** On-device user data (diary, routine log, community profile, order history, age-gate)
  is encrypted at rest with AES-256-GCM (`src/lib/encrypted-storage.ts`). Auth session is encrypted via
  SecureStore (`src/lib/supabase-auth-storage.ts`). Consent and age-gate flags are locked to server RPCs
  (`record_consent`/`withdraw_consent` and `verify_age_18_plus()`/`ensure_profile()`, migration `0026_profile_flags_lock.sql`). Orders are locked to server-side writes (migration `0025_orders_insert_lock.sql`).
- **Camera dogfooding (§12):** Limited strictly to 3 named principals (owner + two cofounders) with signed
  attestations on file. Internal TestFlight permitted only for offline camera builds (`testflight-camera`,
  `EXPO_PUBLIC_CAMERA_DEMO=1`), while production-connected camera builds on TestFlight remain strictly prohibited
  (`docs/ops/camera-on-testflight-compliance.md`).
- **Tests:** 214 test suites, 1228 unit/component tests passing (`npm test`), plus 109 script/compliance
  tests (`npm run test:scripts`), `npm run check:compliance`, and `npm run check:no-egress`.

Build the **balanced skin-tone test set in parallel with step 5** — equal performance across
Fitzpatrick I–VI is the product; verify the read holds up on IV–VI before any equity claim ships.

---

## 6. Escalate, don't improvise

STOP and flag to the founders (human + likely legal sign-off needed) before building anything that
would:

- put a disease name, diagnosis, or treatment/cure claim into any output;
- cause the raw face image to leave the device or reach any third party;
- add any SDK, vendor, or API that can access face / skin / score / health data;
- collect or process data from anyone under 18;
- involve DNA / genetic data (GIPA gate);
- publish an accuracy / efficacy / skin-tone-equity claim without validation data on file;
- expand outside the US (GDPR), or move the read off-device to a cloud skin-analysis API.

When unsure whether something crosses a line, treat it as if it does and ask.

---

## 7. Definition of done for any data-touching feature

Before considering a feature complete, confirm:

- [ ] No raw image persisted server-side; image deleted after analysis.
- [ ] No new SDK/vendor with access to face/health data.
- [ ] Output passes the cosmetic-vocabulary post-filter (no disease terms).
- [ ] Gated behind the 18+ gate and (for scans) the logged consent screen.
- [ ] Covered by delete-everything + the retention/auto-deletion job.
- [ ] Encrypted in transit + at rest; RLS scoped to the owning user.
- [ ] Any user-facing claim is backed by data on file.

---

*Source of truth: the TrueTone Compliance Spec + Illinois Addendum (BIPA, PIPA, ICFA, GIPA, FDA
cosmetic line, COPPA 18+, Apple review). Engineering/compliance guidance, current to mid-2026, NOT
legal advice — counsel reviews before public launch.*
