# TrueTone Core Engine Audit

**Auditor role:** Systems Architect & Technical Product Strategist
**Date:** 2026-09-09 · **Branch:** `feature/stripe-checkout` · **Scope:** READ-ONLY
**Method:** Static read of engine files only (UI/navigation/styling excluded). No build, test, or typecheck run.

**Implementation legend:** ✅ FULLY IMPLEMENTED & host-tested · 🟡 PARTIAL / wrapper / device-only shell · 🔴 STUB / MOCK / PLACEHOLDER / aspirational.

---

## Executive orientation

There are **three** distinct engines in this repo, not one:

1. **Skin-read CV engine** (`src/features/read/`) — a classical (non-ML) computer-vision pipeline that turns one selfie into 8 tone-invariant cosmetic scores + a CIELAB tone. This is the real intellectual property. `modelVersion = 'cv-1'` (`score-from-rgb.ts:18`).
2. **Makeup shade-match engine** (`src/features/shade/`, `src/features/match/`) — a pure deterministic mapping from the read's descriptors to a foundation shade + a ranked product shelf (fit %).
3. **Stripe checkout backend** (`supabase/functions/`, migration `0020_orders.sql`) — server-side order/payment plumbing.

The CV engine is fairness-engineered and host-tested; the shade engine is **built and unit-tested but its tone→shade constants are explicit uncalibrated placeholders**; checkout is a working thin integration.

---

# 1. CORE ENGINE ISOLATION

## A. Ingestion & Contract Boundaries

**No runtime schema library (Zod/Pydantic) is used in the engine.** Contracts are TypeScript interfaces + hand-written boundary checks + Postgres CHECK constraints.

| Boundary | Entry point | Accepts | Validation |
|---|---|---|---|
| On-device read | `runRead(photoUri, deps, captureQuality)` — `read/run-read.ts:18` | a local file **URI (string)** only | none at call site; the URI is a device path |
| Pure scoring core | `scoreFromRgb(rgb, regions)` — `cv/score-from-rgb.ts:20` | `RgbImage` + `Regions` (`cv/types.ts`) | typed only |
| Shade derivation | `deriveShade(ShadeReadInput)` — `shade/derive-shade.ts:88` | `{lightness,warmth,olive,skinType,oiliness}` (`shade/shade-types.ts`) | typed only |
| Product scoring | `scoreProduct(product, profile)` — `match/scoring.ts:62` | `Product`, `MatchProfile` (`match/match-types.ts`) | typed; `never`-exhaustiveness guard on `coverage` (`scoring.ts:49`) |
| Persist read | `record_scan` RPC via `lib/scans.ts:31` | 8 scores + skinType + routine | **DB CHECK constraints** `between 0 and 1`, skinType enum — `0008_scans.sql:8-16` |
| Checkout | edge fn `create-payment-intent/index.ts:6` | JWT + `{items[], shippingAddress}` | manual: `items` non-empty (`:25`); price recomputed server-side (`_shared/checkout/pricing.ts`) |
| Routine chat | edge fn `routine-chat/index.ts:18` | JWT + `{scanId, message, history}` | manual bounds: message ≤2000 chars, history ≤20 turns (`:38-45`) |
| Stripe webhook | `stripe-webhook/index.ts:12` | Stripe event | **HMAC signature verification** (`:23`) |

**Compliance ingestion rule (enforced):** the raw image never becomes a payload. Two CI guard scripts enforce this — `scripts/check-no-image-egress.mjs` (forbids `upload`, `imageUri`, `photo.path`, `FormData`, `.storage` tokens across `src/features/capture`, `src/features/read`, `app/(dev)`) and `scripts/check-no-analytics-sdk.mjs`.

## B. Data Transformation, Execution & Pipelines

End-to-end trace from selfie to shelf:

```
[Capture]  frame metrics → evaluateQuality → captureReducer (hands-free auto-shoot) → still photo URI
[Read]     runRead(uri) → CvReadEngine.run(uri):
             withImageCleanup(uri, …, delete)          ← image deleted in finally, guaranteed
               decodeJpegToRgb(uri)                     🟡 device-only decode shell
               detectFacesOnStill(uri)  (best-effort)  🟡 device-only MLKit shell
               scaleFaceToWorkingSpace + deriveRegionsForFace
               scoreFromRgb(rgb, regions):
                 sampleBaseline (both cheeks → median CIELAB + linear Y + logRG)
                 8 dimensions (each baseline-relative)
                 classify() → skinType
                 → ReadResult {scores, skinType, modelVersion:'cv-1', tone:{L,a,b}}
────────────────────────── compliance boundary: only derived descriptors cross ──────────────────────────
[Shade]    deriveToneFromLab(tone) → {lightness,warmth,olive}   🔴 PLACEHOLDER constants
           deriveShade(...) → CurrentShade {shadeName,undertone,depth 1-10,finish}
           personalization.setScan(shade)  (in-memory only)
[Match]    rankedForFilter(catalog, profile, filter):
             scoreProduct → baseShadeUndertoneFit + applyPreferences → clampFit(40..99)
             fitReason (cosmetic-only text) · rank (best-first, badge top)
[Persist]  recordScan → record_scan RPC → scans row (scores only; NOT the tone/shade)
[Chat]     routine-chat edge fn → Anthropic (scores+routine only) → post-filtered text
[Checkout] create-payment-intent → Stripe PI + orders row → webhook flips status
```

**Stage categorization:**

- **Deterministic (pure, host-tested) ✅** — the entire signal path:
  - `cv/color.ts` — sRGB→CIELAB + the **gain-invariant linear-domain primitives** (`relativeLuminance`, `logChromaRG`). This is the proprietary core: dimensions difference/ratio in the linear domain so a uniform exposure gain cancels *before* the nonlinear `f()` (`color.ts:35-49`).
  - `cv/baseline.ts` — per-person cheek-median baseline (the "fairness keystone": every tone-dependent dimension subtracts against it so skin tone cancels, `baseline.ts:1-2`).
  - 8 dimensions in `cv/dimensions/*.ts` (e.g. `redness.ts` = Δlog(R/G) in T-zone vs baseline — an erythema-index style measure, all baseline-relative).
  - `cv/skin-type.ts::classify` — 4-way threshold classifier.
  - `shade/derive-shade.ts` (`deriveDepth`, `deriveUndertone`, `deriveFinish`), `match/scoring.ts`, `match/sort.ts`, `match/fit-reason.ts`, `_shared/checkout/pricing.ts` — all pure, same-input→same-output.
- **Heuristic / uncalibrated (deterministic code, but magic numbers are admitted placeholders) 🔴** — these set score *magnitude*, and no accuracy claim may ride on them yet:
  - `cv/calibration.ts` `CAL` + `REGION_PROPORTIONS` — "PROVISIONAL … MUST be empirically grounded on real data before any accuracy claim ships" (`calibration.ts:4-8`).
  - `capture/quality-gate.ts` `THRESHOLDS` — "PROVISIONAL — must be re-tuned on a physical device" (`:26`).
  - `shade/derive-shade.ts` `TONE_LAB_LO/HI`, `WARMTH_B_SCALE`, `OLIVE_LO/HI` — "PROVISIONAL / UNCALIBRATED … None of lo/hi below come from a measured skin corpus" (`:18-32`). **This is the weakest link in the shade product.**
- **External LLM / API call 🟡** — only two, both fed derived data, never the image:
  - `routine-chat` → Anthropic `claude-sonnet-4-6` (`routine-chat/index.ts:16,66`), output run through a cosmetic post-filter (`out.blocked`).
  - `create-payment-intent` / `stripe-webhook` → Stripe (`stripe@14.19.0`).
- **Device-only native shells 🟡** — `decode-rgb.ts`, `detect-faces-still.ts`, `executorch-engine.ts`. `CvReadEngine` injects these as deps so the pure core stays host-tested (`cv-read-engine.ts:14-27`).

**Dead / unwired code flagged:**
- 🔴 `cv/illuminant.ts` (136 lines) **EXISTS but is UNWIRED** — it is referenced only in *comments* of `calibration.ts` and `sampling.ts`, never imported into the score path. No white-balance/illuminant correction runs live. Do not treat it as an active stage.
- 🟡 `executorch-engine.ts` — the trained-model path exists but `cv-1` is classical CV; no ONNX/Executorch model is in the live read.
- 🔴 `run-read.ts:45` `__DEV__` **stub fallback** (`stubRead()`) — mock data for Expo Go/web preview; not a real read.
- `match/product-catalog.ts` — **30 synthetic, invented brand-neutral SKUs** (`:15-59`); `image`/`shadeName` are inert display data.

## C. Persistence, State & Artifact Generation

**Persisted (Supabase Postgres, US region, RLS):**
- `scans` (`0008_scans.sql`) — append-only derived scores + skinType + model_version + is_stub. **Insert only via SECURITY DEFINER `record_scan` RPC** (`0009`); clients can `select` own rows only (RLS `:26`). The **tone/shade never persist** — `runRead` maps tone→shade in-memory and drops it (`run-read.ts:31-42`).
- `orders` (`0020_orders.sql`) — Stripe order state; RLS own-row select/insert; webhook updates via service-role key (`0020:29-30`).
- consent log (append-only, immutable — `0003_consent_immutability.sql`), retention/deletion cron (`0005`, `0007`), waitlist (`0014-0016`).

**Ephemeral state:** `personalization.setScan(shade)` holds `CurrentShade` in memory for the result screen + For-You rail (`run-read.ts:35`); lost on app restart. Chat is stateless ("nothing is persisted", `routine-chat/index.ts:3`).

**Final artifacts produced:**
- `ReadResult` (`read-types.ts`) → persisted `Scan` row + generated `Routine` (`lib/scans.ts:31`).
- `CurrentShade` (`shadeName` e.g. "Medium Warm", undertone, depth 1-10, finish).
- `ScoredProduct[]` — ranked shelf, each with `fit` (40-99), cosmetic `reason`, `isBestMatch` badge (`match-types.ts:63`).
- `Order` row + Stripe PaymentIntent.

**Fail-safes / reliability:**
- ✅ `withImageCleanup` (`image-lifecycle.ts`) — deletes image in `finally`, **2 retries, swallows errors so cleanup never throws a leak path**, `onCleanupFailure` hook.
- ✅ Face detection is **best-effort**: a detector failure degrades region placement but never fails the read (`cv-read-engine.ts:30-36`).
- ✅ `clampFit` bounds every fit to 40-99 (`scoring.ts:11`); `norm01` clamps every dimension to 0-1 (`calibration.ts`).
- ✅ Server-side price recompute — client-sent price is ignored, catalog price is authoritative (`pricing.ts:22-24`); guards `qty>0`, unknown SKU, total>0.
- ✅ Stripe webhook signature verification (`stripe-webhook/index.ts:23`).
- ✅ DB CHECK constraints reject out-of-range scores; RLS isolates users.
- 🟡 No retry/idempotency on `record_scan` beyond a thrown error; no reconciliation job for `orders` stuck in `pending`.

## D. Technical Defensibility

**Most complex / time-intensive component:** the **tone-invariant CV read** — specifically the color science in `cv/color.ts` + the baseline-relative differencing in `cv/baseline.ts` and the 8 `dimensions/`, validated by a fairness self-test harness (`eval/fairness/`, per team memory: CV tone-invariance self-test on synthetic FST I–VI faces). The hard, non-obvious work is proving each dimension is *exposure-gain-invariant* (moving redness from Δa* to Δlog(R/G) to cancel exposure — `dimensions/redness.ts:4-16`). That is genuine applied-color-science engineering, not CRUD.

**By contrast, the shade-match layer is shallow:** `deriveShade` + `scoreProduct` are ~150 lines of clean deterministic mapping whose calibration constants are explicit placeholders with **no shade-accuracy evaluation on file**. It is defensible as *architecture* (privacy-clean, on-device, testable) but not yet as *accuracy*.

**Headless service remaining after stripping UI:** a pure function
`selfieRGB → ReadResult(8 scores + skinType + CIELAB tone) → CurrentShade → ranked ScoredProduct[]`,
i.e. `scoreFromRgb` → `deriveToneFromLab`/`deriveShade` → `rankedForFilter`, plus the on-device image-lifecycle guarantee. No network, no UI, no database required for the read+shade+match core. That is the shippable engine.

---

# 2. CAPABILITY-DRIVEN USE-CASE MAPPING

Grounded strictly in what the engine **proves today**: on-device, privacy-clean, tone-invariant per-region CIELAB skin measurement + deterministic foundation-shade/undertone/finish classification + product-fit scoring — with the raw image guaranteed deleted and a CI-enforced no-egress boundary. (Absolute shade *accuracy* is unproven; treat "matching consistency" and "privacy architecture" as the sellable properties, not "correct shade".)

### 1) High-urgency B2B / operational bottleneck — beauty e-commerce shade-match & returns liability
**Problem it automates:** wrong-shade foundation is the dominant driver of beauty e-commerce returns and in-store BA (beauty advisor) labor. Retailers eat the reverse-logistics cost and the color-inconsistency complaints.
**What it displaces:** manual in-store shade consultation, "foundation finder" quiz forms, and cloud shade-scan vendors that upload the customer's face. TrueTone's differentiator is the **on-device, no-image-egress boundary** (`check-no-image-egress.mjs`) — a retailer gets shade matching without becoming a biometric-data controller (the exact BIPA/MHMDA trap the codebase is built to avoid). Engine reuse: `scoreFromRgb` + `deriveShade` map a customer to `{depth, undertone, finish}`, `scoreProduct` maps that to *their own* catalog once `product-catalog.ts` is swapped for real SKUs.
**Caveat:** requires the Phase-2 calibration sweep before any "accurate match" claim; today it sells as consistent, private matching.

### 2) Prosumer / high-frequency operator — the makeup artist / esthetician / beauty creator
**Daily friction removed:** professionals currently eyeball undertone and re-judge shade under every new lighting setup. The engine's exposure-gain-invariant baseline gives a **repeatable tone read across inconsistent lighting** — the same property that makes it fair across skin tones makes it stable across a working day's lighting. A standalone "read + documented shade card (depth word + undertone + finish)" per client, on-device, is a plausible daily tool.
**What it eliminates:** manual undertone guesswork and inconsistent client records; no cloud upload of client faces.

### 3) Developer / headless infrastructure / M&A target — a privacy-first shade-match SDK
**Packaging:** the pure core (`read/cv/`, `shade/derive-shade.ts`, `match/scoring.ts`+`sort.ts`) is already dependency-light and native-shell-isolated — it drops cleanly into an **on-device SDK / npm + native module**, exposing `scoreFromRgb` and `deriveShade`/`rankedForFilter`. No backend required.
**Who acquires/integrates rather than builds:** an AR-beauty / virtual-try-on vendor (ModiFace/Perfect-Corp-class), a foundation brand's digital team, or a retail-tech platform that wants shade matching **without** standing up a face-image cloud pipeline and its BIPA exposure. The build-vs-buy moat is precisely the part that is hard to reproduce: the color-science + the fairness self-test harness proving tone-invariance. The shade-mapping constants are trivially replaceable — the *invariance framework and the eval harness* are the asset worth acquiring.

---

## Appendix — key files cited
`read/run-read.ts`, `read/cv-read-engine.ts`, `read/image-lifecycle.ts`, `read/cv/score-from-rgb.ts`, `read/cv/color.ts`, `read/cv/baseline.ts`, `read/cv/calibration.ts`, `read/cv/skin-type.ts`, `read/cv/dimensions/*.ts`, `read/cv/illuminant.ts` (unwired), `capture/quality-gate.ts`, `capture/capture-controller.ts`, `shade/derive-shade.ts`, `shade/shade-types.ts`, `match/scoring.ts`, `match/sort.ts`, `match/fit-reason.ts`, `match/match-types.ts`, `match/product-catalog.ts`, `preferences/preferences-types.ts`, `lib/scans.ts`, `supabase/functions/{create-payment-intent,stripe-webhook,routine-chat}/index.ts`, `supabase/functions/_shared/checkout/pricing.ts`, `supabase/migrations/{0008_scans,0020_orders}.sql`, `scripts/check-no-image-egress.mjs`.
