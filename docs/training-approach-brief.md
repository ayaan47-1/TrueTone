# TrueTone — Model Training Approach: Briefing & Open Questions

> **Purpose:** a self-contained brief for a strategy discussion about how to train the skin-read
> model. Written 2026-07-26 against branch `feat/scan-accuracy` @ `82a70e4`. It assumes no prior
> knowledge of the codebase — paste it whole.
>
> **Status of the thing being discussed:** there is currently **no trained model**. The shipping
> read is classical computer vision (`modelVersion: 'cv-1'`). This document explains exactly what
> that means, what has been verified about it, what has not, and what the options are for the
> testing phase versus scale.

---

## 0. TL;DR

1. The scan works today with **zero training data** because every measurement is **relative to the
   subject's own skin** — it never needs to know what "normal" looks like in absolute terms.
2. What is verified: **consistency** (same face under different light/framing → same score) and
   **responsiveness** (more defect → higher score). Both were measured, not assumed.
3. What is **not** verified: **accuracy**. There is no ground truth. A score of `0.31` means
   "0.31 on our scale," not "31% oily."
4. A fairness self-test **currently fails by design**: five of eight dimensions respond differently
   across Fitzpatrick I–VI. This is a known, measured, unresolved defect — not a surprise.
5. The highest-value first use of data is **not** training a neural net. It is **grounding the
   raw → 0..1 mapping**, which needs orders of magnitude less data and can be done with *pairwise
   ranking* rather than absolute labels.
6. **The biggest non-obvious risk is legal, not technical.** Collecting face images for training is
   a fundamentally different consent regime from the current analyze-and-delete architecture, and
   it is a founder + counsel decision before it is an engineering one. See §7.

---

## 1. Product and regulatory frame (this constrains every option below)

TrueTone is a **cosmetic / general-wellness** product, deliberately **not a medical device**. The
company is in Illinois, US-only for v0, 18+ only, iOS-primary.

Hard constraints that any training plan must respect:

| Constraint | Consequence for training |
|---|---|
| Raw face image **stays on device** and is deleted immediately after the read | Inference must run **on-device**. No cloud skin-analysis API. Model size/latency are real budget constraints. |
| Illinois **BIPA** governs biometric identifiers | Retaining face images for a training corpus needs written release + published retention schedule. This is a different, heavier consent flow than the current one. |
| Output must be **cosmetic appearance only** | No disease names, no diagnosis, ever. This constrains *what can be labeled*, not just what can be said. |
| **No accuracy / efficacy / skin-tone-equity claim** may ship without backing validation data on file | The current state supports the word "consistent." It does **not** support "accurate." |
| No analytics/ad SDK anywhere near the scan path | No third-party data pipeline for training telemetry. |

The governing principle: US regulators establish a product's classification by its **intended use**,
which is evidenced by the words in the UI *and by what the model was built to do*. This has a
direct and under-appreciated consequence for dataset selection — see §5.2.

---

## 2. How the scan works right now (no model)

### 2.1 Pipeline

```
capture (guided, quality-gated)
  → decode JPEG to ~512px working image  [jpeg-js, on-device]
  → MLKit face detection on the full-res still  [Google, on-device]
  → scale detection into working space + plausibility guard
  → derive 8 anatomical regions from face contours
  → 8 hand-written formulas over pixels in those regions
  → norm01(raw, lo, hi) → 8 scores in 0..1
  → skin type = classify(scores)
  → DELETE the image
  ───────────── compliance boundary ─────────────
  → only derived scores cross to the backend
```

**The only trained model in the pipeline is Google's MLKit face detector, and it does geometry
only** — it finds *where* the face and its contours are. It never assesses skin. It was already
present for the capture gate, so it introduced no new vendor.

### 2.2 The eight dimensions, literally

| Dimension | What the code actually computes |
|---|---|
| `texture` | mean \|Laplacian\| ÷ local luma over the forehead ("micro-contrast") |
| `hydration` | `1 − texture` — the same number, inverted |
| `pores` | fraction of T-zone pixels exceeding a Weber-relative local-contrast threshold (0.06) |
| `darkSpots` | fraction of pixels where `1 − Y/baselineY > 0.10` (Y = linear relative luminance) |
| `redness` | `log(ΣR/ΣG)` in the T-zone, minus the cheek baseline |
| `oiliness` | fraction of T-zone pixels whose **chroma drops** toward the illuminant, plus an additive lightness lift (smooth gate) |
| `darkCircles` | L\* deficit under the eyes vs the cheek baseline |
| `fineLines` | tone-relative horizontal gradient energy |

**Why this works without training data:** every measure is referenced to *the subject's own cheek
baseline*. A trained model must learn what normal skin looks like across every tone; a relative
measure never asks — the subject's own skin cancels out of the arithmetic.

**Known redundancy:** there are 8 scores but **7 independent measurements**. `hydration` and
`texture` read the same region through the same function with identical normalization ranges, so
`hydration ≡ 1 − texture` exactly. This needs a decision: acceptable framing, or does hydration
need its own signal?

### 2.3 The calibration constants — where "no training data" actually bites

Raw physical quantities are mapped to 0..1 by `norm01(raw, lo, hi)` with hand-picked constants:

```
redness:     lo 0,    hi 0.7      (Δ log(ΣR/ΣG))
darkCircles: lo 0,    hi 25       (ΔL*)
oiliness:    chromaDrop 0.65, lift 9, lo 0, hi 0.29
texture:     lo 0,    hi 0.3
hydration:   lo 0,    hi 0.3
pores:       relThr 0.06, lo 0, hi 0.3
fineLines:   lo 0,    hi 0.3
darkSpots:   relThr 0.10, lo 0, hi 0.25
```

The calibration file's own header says it plainly:

> *"PROVISIONAL: these hi/threshold values are heuristic … They set score magnitudes, not the
> fairness property, and MUST be empirically grounded on real data before any accuracy claim
> ships."*

These were swept against **synthetic rendered faces** until the invariance tests passed. Nothing
anchors them to real human skin. **This is the single most valuable thing data could fix, and it is
also the cheapest.**

---

## 3. What has actually been verified

A synthetic-face renderer + invariance harness was built as a measurement instrument. It renders
parametric faces across Fitzpatrick I–VI with controllable defects, illuminants, and geometry, then
asserts properties of the read. Five axes:

| Axis | Question it asks | Verdict |
|---|---|---|
| **illuminant** | Same face, different colour temperature and exposure → same scores? | ✅ PASS |
| **geometric** | Same face, different framing/scale/position → same scores? | ✅ PASS |
| **monotonic** | More defect → strictly higher score? (Spearman ρ) | ✅ PASS (floor 0.90; worst 0.9535) |
| **tone-preservation** | Does the read avoid drifting with skin tone on a *clean* face? | ✅ PASS |
| **defect-tone-fairness** | Does *the same defect* read the same on every skin tone? | ❌ **FAIL** |

> ⚠️ **`Overall: FAIL` from `npm run eval:invariance` is the intended state.** The fifth axis was
> added deliberately, knowing it would fail, so the gap is measured rather than assumed. Do not
> "fix" it by loosening a bound. Four axes passing is an earned result — every review verified the
> epsilon block stayed byte-identical.

### 3.1 The fairness gap, quantified

Score spread for the *same* defect across Fitzpatrick I–VI (lower = fairer):

| Dimension | Spread | Note |
|---|---|---|
| `oiliness` | **0.257** | Worst, and non-monotonic across tone |
| `redness` | 0.179 | |
| `darkCircles` | 0.161 | |
| `pores` | 0.157 | |
| `darkSpots` | 0.043 | ✅ passes |
| `fineLines` | 0.030 | ✅ passes |
| `texture` / `hydration` | 0.007 | ✅ pass; one measurement, counted once |

**Equal performance across I–VI is the product.** This axis measures the actual equity claim, and it
is currently unmet.

### 3.2 What the harness cannot tell us

It is a *self-consistency* instrument. Synthetic faces are generated by our own renderer, so the
harness can prove the read is stable and responsive — it can **never** prove the read is *correct*,
because the "ground truth" is our own model of what skin looks like. Circularity is inherent.

The invariance harness scores the same contour-derived region path production prefers and records
that provenance in each report. Its synthetic contours mirror the cardinalities observed from
MLKit on hardware; a failed contour derivation aborts the eval instead of falling back to bounds.

---

## 4. The two separable training problems

These get conflated constantly. They have wildly different data requirements, costs, and risk.

### Problem A — Ground the mapping (raw → score)

Keep the hand-written extractors. Replace the guessed `lo`/`hi`/`relThr` constants with values
derived from real faces.

- **Data needed:** small. Hundreds, not millions.
- **Labels needed:** *relative*, not absolute — see §5.1.
- **Unlocks:** scores that mean something; the beginning of an evidence file for any accuracy claim.
- **Risk:** low. No architecture change, no new runtime, no model shipping.

### Problem B — Learn the extractors

Replace the formulas with a trained network producing the score vector.

- **Data needed:** large, tone-balanced, defect-diverse.
- **Labels needed:** per-dimension, per-image, from trained raters.
- **Unlocks:** potentially higher ceiling; captures signals no formula encodes.
- **Risk:** high. Must run on-device (Executorch/ONNX, quantized). Introduces opacity into a
  pipeline whose current auditability is a compliance asset. Also: **a learned model can encode
  tone bias more subtly than a formula can**, and it is harder to prove it hasn't.

**Strong recommendation: do A first, and fix the fairness gap before B.** Collecting an expensive
corpus to paper over a structural bias bug in hand-tuned constants is the wrong order of operations.
The fairness failures in §3.1 are traceable to specific formulas — they are debuggable now, for
free, using the existing synthetic harness.

---

## 5. Testing phase — what to do with no data spend

### 5.1 The cheap high-value move: pairwise ranking, not absolute labels

To fix `norm01`'s `lo`/`hi` you do not need someone to say "this forehead is 0.4 oily." You need a
**monotone mapping to a perceptual scale**, and for that, *pairwise comparisons* are dramatically
cheaper and more reliable:

> "Which of these two foreheads looks shinier — A or B?"

- Humans are poor at absolute magnitude, good at relative comparison. Inter-rater agreement on
  pairwise judgments is far higher.
- Bradley–Terry / Thurstone scaling converts pairwise votes into a latent scale, which is exactly
  what `lo`/`hi` need.
- N images gives up to N(N−1)/2 comparisons — enormous label efficiency from a small corpus.
- Raters need no dermatology training, which matters: **untrained raters judging appearance keeps
  the labeling task cosmetic**. Clinically-trained raters grading severity would push the intended
  use toward diagnostic. This is a feature, not a compromise.

### 5.2 ⚠️ Public dermatology datasets — available, and legally fraught here

Datasets like Fitzpatrick17k, SCIN, and DDI exist, are Fitzpatrick-labeled, and are the obvious
first thought. **They are a poor fit for this product for a reason that is not about licensing.**

They are **clinical dermatology corpora labeled with diseases**. Training a model on eczema,
rosacea, and melanoma images creates a documentary record that the system was built to recognize
disease. Under the "intended use" doctrine that governs the cosmetic/medical line, that record is
evidence — and it lives in the training provenance regardless of how the UI is worded. This
directly conflicts with the product's foundational position.

*Flagging rather than asserting:* whether this risk is disqualifying or merely manageable is a
question for counsel. But it should be asked **before** anyone downloads a corpus, not after. Note
also that each of these datasets has its own license and consent terms requiring independent review.

Untagged face corpora (FFHQ, CelebA and similar) carry no disease-label problem but also carry **no
skin labels**, so they cannot ground calibration. They may still be useful for a narrower purpose:
verifying that region derivation and the illuminant/geometry invariance properties hold on real
faces rather than synthetic ones. That is a real gap worth closing cheaply. Licenses (several are
research-only / non-commercial) must be checked against commercial use.

### 5.3 Options that need no external data at all

| Option | Cost | What it buys |
|---|---|---|
| **Fix the fairness gap using the existing synthetic harness** | Engineering only | Directly attacks the failing axis. The formulas causing it are known and small. |
| **Founder/team self-capture with self-rated pairwise labels** | ~zero | Real skin, real lighting, real phones. n is small and tone coverage will be poor — honest about that — but it catches gross calibration errors immediately. |
| **Deliberate lighting/device sweep of a handful of consenting people** | ~zero | Tests invariance on *real* faces, which the synthetic harness structurally cannot. |
| **Expand the synthetic renderer's realism** | Engineering only | Cheap, but note the circularity in §3.2 — this raises confidence in consistency, never in accuracy. |
| **Complete the device pass (Task 15)** | Already scoped | Currently the read's region placement is unverified on real hardware. Any calibration work done before this could be calibrating against mis-placed regions. **Blocking prerequisite.** |

### 5.4 Suggested testing-phase sequence

1. **Device pass** — verify regions land on real features (EXIF/orientation is still unverified).
2. **Fix the fairness axis** — synthetic harness, no data, `oiliness` first (worst and non-monotonic).
3. **Resolve the `hydration ≡ 1 − texture` redundancy** — product decision.
4. **Small consented real-face set** — team + volunteers, deliberate tone and lighting spread.
5. **Pairwise ranking exercise** → refit `lo`/`hi` → re-run the full invariance harness to confirm
   nothing regressed.
6. **Only then** evaluate whether Problem B is worth it.

---

## 6. Scale phase — proprietary data

The likely end state is a proprietary corpus from consenting users. Before that is designed:

### 6.1 The architectural collision

The current architecture's central promise — *the image never leaves the device and is deleted
immediately* — is what makes the compliance story clean. **A training corpus requires retaining
images.** These are in direct tension, and the tension cannot be engineered away, only chosen
around. Realistic options:

| Approach | Trade-off |
|---|---|
| **Separate opt-in donation flow** | Explicit, separate, revocable consent to retain; distinct from the scan consent. Cleanest legally, lowest opt-in rate, slowest corpus growth. |
| **Federated / on-device learning** | Images never leave; gradients or aggregates do. Preserves the promise. Materially harder to build; aggregate leakage is its own research problem; hard to debug. |
| **Derived-features-only retention** | Ship the score vector plus intermediate features, never pixels. Cheap and compatible with today's boundary — but you can only ever retrain the *mapping*, never the extractors, and you can't re-label later. |
| **Paid/commissioned dataset** | Cleanest consent, controlled tone balance, no user-trust cost. Costs money. Currently ruled out by the no-spend constraint. |

**Worth noting:** the derived-features-only option is a strong fit for Problem A specifically and
would not require changing the compliance boundary at all. That makes it a plausible bridge.

### 6.2 Non-negotiables for any collection program

- Written release + published retention schedule (BIPA).
- Separate, revocable, unbundled consent — **never** bundled into the scan consent.
- Deletion must actually propagate to the training corpus and to backups on a defined cycle. *A
  model already trained on deleted data is an unresolved question — raise it with counsel explicitly.*
- Tone balance is a **design requirement of the collection protocol**, not something to fix in
  post. A corpus skewed to Fitzpatrick I–III bakes in exactly the inequity the product exists to
  avoid.
- No third-party labeling vendor touches face images without its own consent chain and DPA.

---

## 7. What needs founder + legal sign-off before engineering starts

Per the project's escalation rules, all of these cross the line:

- [ ] Retaining any face image beyond the read (**changes the core architectural promise**)
- [ ] Any external dataset with disease labels (**intended-use risk**, §5.2)
- [ ] Any third-party labeling vendor or annotation platform
- [ ] Any published accuracy or skin-tone-equity claim (needs validation data on file first)
- [ ] Whether a model trained on later-deleted data must be retrained

---

## 8. Open questions for the discussion

1. **Sequencing:** is fixing the fairness gap before collecting data the right call, or does real
   data change the diagnosis of *why* it fails?
2. **Ceiling:** is there a defensible ceiling on relative/classical CV? Is Problem B necessary at
   all, or is a well-calibrated formula sufficient for a cosmetic product?
3. **Labels:** is pairwise ranking sufficient to ground calibration, or is an absolute scale needed
   for the product's own UX (e.g. "your oiliness is 0.4" implies an absolute meaning)?
4. **`hydration`:** give it a real signal, or drop it and reframe as texture only?
5. **Collection model:** separate opt-in donation, federated, or derived-features-only as a bridge?
6. **Corpus target:** what n, and what tone distribution, would actually support an equity claim?
   (This determines the cost of everything downstream.)
7. **Auditability:** how much of the current pipeline's transparency are we willing to trade for a
   learned model's ceiling?

---

## 9. Reference — where things live

| Thing | Path |
|---|---|
| Scoring core (pure, host-tested) | `src/features/read/cv/score-from-rgb.ts` |
| The eight extractors | `src/features/read/cv/dimensions/` |
| Calibration constants | `src/features/read/cv/calibration.ts` |
| Region derivation from contours | `src/features/read/face-geometry.ts` |
| Device wrapper (decode + detect + delete) | `src/features/read/cv-read-engine.ts` |
| Synthetic face renderer | `eval/render/` |
| Invariance harness + thresholds | `eval/invariance/` |
| Latest report | `eval/reports/invariance.{md,json}` |
| Unused ML runtime seam | `src/features/read/executorch-engine.ts` |
| Run the harness | `npm run eval:invariance` |

**Current test state:** 646 tests / 125 suites passing, `tsc` clean, compliance and no-egress guards
passing. Branch held at 47 commits pending the device pass.
