# Shade Calibration — Data & Claims Readiness Gate

**Date:** 2026-09-23
**From:** Engineering (compliance)
**Decision owners:** Founders + outside counsel
**Status:** GATE — a protocol engineers execute *after* capture control passes on-device. Docs only;
this memo acquires no data and ships no claim.
**Task:** `tt-gap01-shade-calibration-readiness`. Does **not** bypass `tt-capture-reliability` or
`tt-consent-deeptone-scope` — both are hard upstream gates (§1).
**Companions:** `docs/capture-reliability-plan.md` (capture control); `docs/compliance/consent-options-deep-tone-data.md`
(consent instrument for real IV–VI data — on branch `docs/consent-options-deep-tone`, not merged);
`docs/compliance/dataset-requirements-brief.md` (L1–L7 / T1–T6); `docs/training-approach-brief.md`
(fairness gap §3, calibration constants §2.3); `docs/ARCHITECTURE.md` (compliance boundary,
`eval/fairness/`).

---

## 0. What this gate is, and the one-line answer

Shade calibration means grounding the read's Lab→shade mapping (and the provisional `norm01` / capture
constants) against **real** skin so the shade output means something. The question this gate answers:
**what data may we lawfully use, what must the numbers clear, and what may we say about the result.**

**Answer:** two data tiers, never conflated (§2). **Tier A (internal calibration test data — founders'
own faces / a colour-reference target)** unblocks the near-term work under the existing two-named-
principal camera cap and needs no new consent instrument. **Tier B (a real Fitzpatrick IV–VI corpus)**
is required only to *certify* fairness or ship any accuracy/equity claim, and is fully blocked on
counsel via `tt-consent-deeptone-scope`. Until validation data is on file **the product ships
factual-only claims** (§6). Calibration runs **only after capture is controlled** (§1).

---

## 1. Hard upstream gates (do not bypass)

Calibration and any claim are blocked until all three clear. This ordering is not optional — each
prior step makes the next one meaningful.

1. **Capture control lands + is device-validated** (`tt-capture-reliability` Changes 2–3: WB/exposure/
   ISO lock + screen-flash, on a physical device). The shade engine measures `skin × light × sensor`,
   not skin (`capture-reliability-plan.md` Problem). Calibrating Lab→shade against an uncontrolled
   capture calibrates noise — and the error concentrates on deep tones (auto-exposure over-brightens
   dark faces). `capture-reliability-plan.md` §Sequencing step 4 is explicit: shade calibration comes
   *only after* capture is controlled. **Blocker owner: Toby + human on-device test.**
2. **Consent instrument for Tier B is chosen** (`tt-consent-deeptone-scope`) before any real IV–VI
   corpus is acquired. Tier A does **not** wait on this (it acquires no user/third-party corpus).
   **Blocker owner: counsel.**
3. **Device pass — regions land on real features** (`training-approach-brief.md` §5.4 step 1).
   Calibrating against mis-placed sampling regions calibrates the wrong pixels. **Blocker owner:
   human on-device test.**

---

## 2. Lawful data routes & provenance — the two tiers

| | **Tier A — internal calibration test data** | **Tier B — real Fitzpatrick IV–VI corpus** |
|---|---|---|
| **What** | Founders' own faces + a colour-reference target, captured under varied lighting/devices | A balanced, real deep-tone face set at population scale |
| **Buys** | Calibrate locked exposure/ISO, screen-flash intensity, brightness floor, and the Lab→shade mapping; catch gross calibration errors | Ground constants against real deep skin at scale; the **held-out set that certifies** IV–VI fairness |
| **Route / provenance** | Internal, **attested** — same posture as the §12 cofounder camera attestation (own device, knowing principal, image deleted on-device, nothing retained off-device beyond derived constants) | Per consent-options memo: **Option A** licensed consent-verified corpus (recommended) or **Option B** commissioned US top-up; **reject** academic/open (disease-label intended-use + consent fail) and in-app donation (breaks the on-device red line). Paperwork = L1–L7. |
| **Consent instrument** | None beyond the existing attestation; **not** a consented user BIPA corpus (`capture-reliability-plan.md` §Calibration dependency) | The `tt-consent-deeptone-scope` decision — blocked on counsel |
| **Architecture** | **No scan-path change.** On-device raw-image-delete invariant untouched (`withImageCleanup`); egress guard stays green | Images retained in a **governed store beside the app**, disjoint from prod and from `eval/fairness/` (T6) — a new bounded obligation, **not** a scan-path change |
| **Camera cap** | Stays inside the two-named-principal direct-install cap; **never TestFlight** | Not our camera — cap not implicated (Option A/B via vendor/agency tooling) |

**Hard line for Tier A:** it may catch gross errors but it **cannot certify IV–VI fairness** — founder
faces under-cover deep tones (only a Fold 7 has been tested). Do **not** let Tier-A captures accrete
into a stored off-device face dataset; keep only the derived numeric constants.

---

## 3. Retention & revocation

- **Tier A:** retain **derived constants (numbers), not images**. Any reference capture kept for a
  calibration session is under the attestation, on a defined delete cycle, never a growing corpus.
  Revocation is trivial (own principals).
- **Tier B:** BIPA §15(a) published retention schedule; deletion must **propagate to the corpus and
  backups** on a defined cycle (`training-approach-brief.md` §6.2). Revocation handled by the vendor
  deletion-propagation clause (Option A) or our consent-form withdrawal (Option B). **Open for counsel:**
  calibration constants are aggregate/de-identified — must they be **re-fit** when a subject revokes,
  or is deleting the source image sufficient? (C2.)

---

## 4. IV–VI representation requirement

Equal performance across Fitzpatrick I–VI **is the product** (`dataset-requirements-brief.md` T1). To
certify it:

- Tier B must hit **T1 balance** (≥15% per Fitzpatrick type, ideally near-uniform) and be **strictly
  disjoint** from the held-out fairness eval set (T6) — training/calibrating on the eval set voids the
  certification.
- The **held-out real IV–VI set is the only fairness-certification instrument.** The synthetic
  self-test (`eval/fairness/self-test-images.ts`) proves *algorithm tone-invariance*, **never**
  real-world fairness — `ARCHITECTURE.md` §Fairness-eval §9: no equity claim ships from synthetic
  results.

---

## 5. Metrics & thresholds

**Existing harness (`eval/fairness/`, already merged):** `gate-parity.ts` (quality-gate pass-rate
parity across FST groups), `bias.ts` (Pearson corr(Fitzpatrick, score) per dimension with a
practical-significance effect floor), `thresholds.ts` (provisional, **policy-owned**), fail-closed
verdict, aggregate-only report.

**Current state (synthetic):** 5 of 8 dimensions FAIL defect-tone-fairness — `oiliness` spread 0.257
(worst, non-monotonic), `redness` 0.179, `darkCircles` 0.161, `pores` 0.157
(`training-approach-brief.md` §3.1). This is a **known, measured defect**, not a surprise.

**Shade-specific metrics to add (against Tier-B ground truth on real faces):**
1. **Shade accuracy** — ΔE (Lab distance) of derived shade vs a reference shade, and depth/undertone/
   finish band agreement, reported **per Fitzpatrick group**.
2. **Shade fairness** — accuracy parity across I–VI (the equity axis for shade, mirroring `bias.ts`).
3. **Gate parity** — capture pass-rate parity across I–VI (deep-tone captures must not be rejected
   more; the brightness-floor fix targets this).

**Two rules on thresholds (record as policy):**
- **Set the pass bars before the eval runs.** Thresholds are policy-owned (founders + counsel), fixed
  up front — never reverse-engineered to pass.
- **Never loosen a bound to go green.** `training-approach-brief.md` §3 and `ARCHITECTURE.md` are
  explicit; a loosened epsilon is a silent equity regression.

---

## 6. Launch claims

**Forbidden until validation data is on file AND founders + counsel sign off** (`CLAUDE.md` §1/§6):

- Any **accuracy** claim — "accurate", "X% accurate", "clinically proven", "dermatologist-level".
- Any **skin-tone-equity** claim — "works for every tone", "validated across every skin tone", "tuned
  fairly for every tone". (`ARCHITECTURE.md` already gates this exact caption; it ships as the factual
  "Fitzpatrick I–VI" instead.)
- Any **exact-match / speed-accuracy** claim — "exact shade", "perfect match", "your shade in N
  seconds".
- Any **absolute number** as a claim — shade depth ships as a **word**, not "X/10"; `SKIN_AGE_ABSOLUTE_ENABLED`
  stays `false`.
- Any **medical/diagnostic** framing — disease names, "corrects/repairs/treats", structure/function.
- Any **`%` stat** without a backing evidence file.

**What may ship now (no new data):** factual descriptors ("Fitzpatrick I–VI"), the verified word
**"consistent"** (not "accurate"), within-user *relative* framing, and cosmetic shade descriptors
("Medium Warm").

---

## 7. Execution protocol (post-capture)

Runs only after §1 clears.

1. Fix the **synthetic fairness gap** (`oiliness` first — worst and non-monotonic) so calibration is
   not grounding a biased formula (`training-approach-brief.md` §4: fix fairness before collecting).
   *Free, in-house, no data.*
2. Run **Tier-A internal calibration** (founder faces + reference target under the two-principal cap):
   re-fit locked exposure/ISO, screen-flash intensity, brightness floor, and a first Lab→shade
   mapping. Retain constants only.
3. **Draft the threshold policy** (§5) and get founder/counsel sign-off (F2) **before** any real-data
   eval.
4. **Only then**, once counsel has chosen the Tier-B instrument (C1): acquire the balanced held-out
   IV–VI corpus (T1/T6), re-fit constants against real skin, run the shade-accuracy + fairness eval.
5. If — and only if — the eval clears the pre-set bars, assemble the **evidence file**; a specific
   claim ships only after counsel signs off on that file (C5).

---

## 8. Exact decisions required

**Founders**
- **F1.** Approve the sequencing in §1/§7 — no shade calibration or claim before capture control passes
  on-device.
- **F2.** Set/approve the fairness + shade-accuracy **thresholds before** the real-data eval runs.
- **F3.** Decide whether an accuracy/equity claim is even a launch goal. If **no**, ship factual-only
  (§6) and the whole Tier-B corpus + spend can defer.
- **F4.** Confirm the **budget envelope** for Tier B (`dataset-requirements-brief.md` §6).

**Counsel**
- **C1.** Choose the Tier-B consent instrument (the `tt-consent-deeptone-scope` decision — Option A, or
  A + B); confirm the vendor consent reaches **commercial ML / calibration** use, not just "research".
- **C2.** Approve retention schedule + deletion-propagation, and rule on **re-fit-on-revocation** (§3).
- **C3.** **EU AI Act Art. 5(1)(g):** does Fitzpatrick/shade labeling constitute prohibited biometric
  categorisation inferring race/ethnicity? Gates any EU-subject data and the non-US launch.
- **C4.** Confirm **Tier-A** internal calibration (founder faces / reference target, attested,
  deleted on-device) needs **no external consent instrument** and stays outside the BIPA-corpus duty —
  aligned with the §12 attestation.
- **C5.** Sign off that a specific claim's evidence file is sufficient **before** it ships.

---

## 9. Cheapest reversible first step

**Touch no real deep-tone user or third-party faces yet.** The cheapest progress is entirely in-house
and unblocks everything downstream: (1) finish the device pass + capture Changes 2–3
(`tt-capture-reliability`); (2) fix the synthetic `oiliness` fairness gap; (3) run Tier-A internal
calibration under the two-principal cap; (4) draft the threshold policy for founder sign-off. Only
after those four, and after counsel picks the Tier-B instrument, does any real-corpus spend or
download begin. Each step is reversible and retains no biometric data of any third party.

---

*Engineering readiness gate, not legal advice. Counsel reviews the consent instrument and the claim
evidence file before acquisition or launch. No standing constraint is relaxed by this memo: the raw
face image stays on-device and is deleted after read; no analytics/ad SDK on the scan path; the camera
build is direct-install / two-named-principals only.*
