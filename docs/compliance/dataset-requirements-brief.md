# Training-Dataset Requirements Brief — for Founders / Legal

**Date:** 2026-07-03
**From:** Engineering
**Decision owners:** Founders + outside counsel (Illinois biometric privacy)
**Status:** AWAITING DECISION — this brief is the gate on the entire trained-model track
**Companion spec:** `docs/superpowers/specs/2026-07-02-trained-model-track-design.md`

---

## 1. What we're asking for

A **consented or licensed face-image dataset** we may lawfully use to train TrueTone's
on-device skin-appearance model. Engineering is blocked on this acquisition decision:
the model pipeline (training scaffold, export contract, fairness validation harness) can
be built without data, but no training run happens until a dataset that meets the
requirements below is on file with its paperwork.

**What this is NOT:** we are not asking to use our users' photos. User selfies never
leave the device, are deleted after each read, and are never training data — that is a
BIPA red line and a standing product commitment, not a cost trade-off.

## 2. Why we need it

Today's read is classical computer vision with hand-set calibration constants —
deterministic and fair-tested, but heuristic. A trained model is how the read gets
genuinely better, and it is the only path that could ever support an accuracy or
skin-tone-equity statement (which itself would still require validation data on file
plus separate founder/legal sign-off before any such claim ships).

The model is trained **offline by us** and shipped as **fixed weights inside the app**
(an ExecuTorch asset). It runs entirely on-device. It does not learn from users, and
inference never sends anything anywhere.

## 3. Hard requirements (any dataset must meet ALL of these)

### Legal / provenance — counsel confirms each item

| # | Requirement | Why |
|---|---|---|
| L1 | **Written consent or commercial license that expressly covers biometric analysis and ML model training** — not just "research use" | BIPA §15(b) informed consent; many academic datasets prohibit commercial/ML use |
| L2 | **Commercial use permitted**, sublicensing/derivative-model terms understood | We ship the trained weights in a paid product |
| L3 | **Adults 18+ only**, with age verified or warranted by the licensor | Mirrors our own 18+ gate; no minors' biometric data, period |
| L4 | **US-lawful provenance**; no scraped datasets (no web-crawled face corpora, however popular) | Scraped faces = the Clearview fact pattern; indefensible under BIPA |
| L5 | **Right to retain the data** for the training + validation period, with a defined deletion/retention schedule | Matches our published retention posture |
| L6 | **Complete paperwork retained on file**: license agreement or consent forms, provenance chain, licensor warranties | This file is what protects us in an audit or suit |
| L7 | **No data broker sourcing** where subjects were compensated-but-not-informed or consent is unverifiable | Consent quality matters as much as its existence |

### Technical — engineering confirms each item

| # | Requirement | Why |
|---|---|---|
| T1 | **Balanced Fitzpatrick I–VI representation** — target ≥15% per type minimum, ideally near-uniform; skin-tone labels included or derivable | Equal performance across tones IS the product; imbalanced data bakes in the bias we exist to avoid |
| T2 | **Frontal selfie-style face photos**, consumer-camera quality, varied lighting | Must match what our capture flow actually produces |
| T3 | **Per-image cosmetic-appearance labels** for our 8 dimensions (hydration look, oiliness, texture, pores, appearance of dark spots / redness / fine lines / dark circles) **and/or** skin type (dry/oily/combination/sensitive-feeling) — **or** licensor permission to have the images labeled by annotators we engage | The model's output contract is 8 scores + 4 skin-type logits; unlabeled images alone can't train it |
| T4 | **Cosmetic labels only** — we do not want disease/diagnosis annotations (acne grades, lesion labels, etc.) | Training on diagnostic labels drifts the product toward the medical line we must not cross |
| T5 | **Scale:** ~5,000–20,000 usable labeled images as a working target (fewer works with a pretrained backbone; balance per T1 matters more than raw count) | Enough per Fitzpatrick type per dimension for training + an internal validation split |
| T6 | **Strictly disjoint from our fairness eval set** (`eval/fairness/`) — no overlapping subjects or images | The held-out fairness set is our tone-fairness certification; training on it would invalidate it |

## 4. Sourcing options (engineering's read — counsel to vet)

1. **Commercial dataset vendor with consent-verified collection** (vendors exist that
   collect face data with explicit signed biometric/ML consent and Fitzpatrick balance;
   some also sell skin-attribute labels). *Likely the fastest clean path.* Expect a
   five-figure license for this scale; balanced IV–VI coverage is the thing to
   scrutinize — many "diverse" datasets are still I–III-heavy.
2. **Commissioned collection** through an agency that recruits paid, consenting adult
   participants under our own consent form (drafted by counsel). Slower and likely
   costlier, but the consent instrument is exactly ours and Fitzpatrick balance is
   specified up front.
3. **Academic/open datasets** — almost always fail L1/L2 (non-commercial terms) or L4
   (scraped). Treat as a red flag by default; only usable if a specific set clears every
   L-item, which counsel should assume it won't until proven otherwise.

A hybrid is plausible: a licensed base set (option 1) plus a smaller commissioned top-up
(option 2) targeted at whichever Fitzpatrick types the base set under-covers.

## 5. What happens after "yes"

1. Counsel + founders approve a source; paperwork goes on file (L6).
2. Engineering builds/finishes the training repo (scaffold is spec'd and buildable now,
   pinned to the existing on-device output contract).
3. Train → export to ExecuTorch → validate on the **held-out** Fitzpatrick I–VI fairness
   harness (already merged and wired) + calibration eval vs. the labels.
4. Only if fairness verdicts pass does the model replace the classical-CV engine, per
   the cutover checklist in the companion spec. No accuracy/equity claim ships from this
   work alone — that is a separate, later founder/legal decision with the validation
   data as its prerequisite.

## 6. The decision we need

- [ ] Choose a sourcing path (§4) — or decline/defer the model track for now.
- [ ] Engage counsel to vet the chosen source against L1–L7 before any money moves
      or any data is downloaded.
- [ ] Confirm budget envelope for the license/collection + labeling.

Until all three boxes are checked, engineering proceeds only on the inert-safe items
(training-repo scaffold, native image decode, fairness-harness adapter) and the shipped
product continues on the classical-CV read.

---

*Engineering brief, not legal advice. Counsel reviews the chosen dataset's terms before
acquisition.*
