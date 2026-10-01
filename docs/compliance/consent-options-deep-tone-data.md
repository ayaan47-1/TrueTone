# Consent Options for Acquiring Real Fitzpatrick IV–VI Face Data — Decision Memo

**Date:** 2026-09-15
**From:** Engineering (compliance)
**Decision owners:** Founders + outside counsel (Illinois biometric privacy; add data-protection
counsel for any non-US collection)
**Status:** AWAITING COUNSEL — scoping memo, not an implementation. No code, config, or consent copy
changed by this document.
**Companions:** `docs/training-approach-brief.md` §3 (why we need real data), §6.1 (the architectural
collision); `docs/compliance/dataset-requirements-brief.md` §3 (L1–L7 / T1–T6 requirements), §4 (the
sourcing options this memo prices).

---

## 0. The question, and the answer up front

**Question:** under what consent instrument can TrueTone lawfully obtain **real Fitzpatrick IV–VI
face images** for offline model work, and what does each option cost us legally and architecturally?

**Recommendation:** **Option A — a licensed commercial dataset with consent-verified, ML-training-
scoped biometric consent and specified IV–VI balance**, with **Option B (commissioned collection)**
held as an IV–VI top-up if the base set under-covers deep tones. Both keep the shipped **scan path's
analyze-and-delete boundary untouched** (a designed store lives *beside* the app, never inside it) and
both leave the **two-named-principal camera cap intact**. Avoid **Option D (in-app user donation)** —
it is the only path that breaks the core "image never leaves the device" promise and is an
architecture change, not a policy change. Avoid **Option C (academic/open)** on both consent (L1/L2/L4)
and intended-use (disease-label provenance) grounds.

**Cheapest reversible first step:** §5. Commit nothing, download nothing, retain nothing yet.

---

## 1. Why this is on the table

The fairness self-test **fails by design**: 5 of 8 read dimensions respond differently across
Fitzpatrick I–VI, quantified in `training-approach-brief.md` §3.1 (`oiliness` spread 0.257 worst,
non-monotonic; `redness` 0.179; `darkCircles` 0.161; `pores` 0.157). §3.2 establishes the synthetic
harness can **never** close this — it is self-consistency over our own renderer, so circularity is
inherent. Real deep-tone faces are the only instrument that can. The founder is separately weighing a
non-US launch (Asia/Africa), which concentrates users in IV–VI — so the consent instrument may have
to hold **outside** US law, which changes the analysis materially (see §3, §4B/D).

---

## 2. The constraint that shapes every option (read before the options)

One product red line governs all four options and is **not** on the table to trade:

> **User selfies are never training data.** They stay on-device, are deleted after each read, and are
> never uploaded, logged, or cached (`src/features/read` `withImageCleanup`; enforced by the
> `check-no-image-egress` CI guard on `src/features/capture`). This is a BIPA red line and a standing
> product commitment.

Therefore **every viable option acquires deep-tone faces *outside* the scan path.** The only question
is *whose* faces, under *what* instrument, and *where* those images are retained. Two secondary
standing constraints also bind and are called out per option:

- **Two-named-principal camera cap:** any build that runs our camera is direct-install to two named
  principals only, **never TestFlight/ASC** (`docs/ops/camera-on-testflight-compliance.md` §10/§12).
- **18+ gate + logged consent before camera**, and **no analytics/ad SDK on the scan path.**

**Server-side image retention is an architecture change, not a policy change.** Options are flagged
explicitly below for whether they put face images into company-controlled storage, and if so whether
that storage is *beside* the app (a governed offline training store — acceptable, new obligations) or
*inside* the scan path (breaks the red line above — Option D only).

---

## 3. Regime baseline (defined once; per-option sections stay terse)

**US baseline — applies to any subject who is a US resident, wherever collected:**

- **Illinois BIPA** — §15(b) requires *informed written consent* before collection of a biometric
  identifier (a face image qualifies); §15(a) requires a *published retention + destruction schedule*
  and destruction when purpose is met or within a set period. Private right of action; statutory
  damages ($1,000 negligent / $5,000 reckless per violation) — this is the expensive one.
- **Washington MHMDA** — a face image + derived skin metrics are "consumer health data." Requires
  separate affirmative *consent* to collect and a distinct *valid authorization* to sell/share. We do
  not sell, so the sale-authorization is not triggered; the collection-consent and consumer rights
  (withdraw/access/delete) do apply if any WA resident is a subject.
- **Illinois GIPA — NOT implicated.** No DNA/genetic data is collected by any option here; GIPA
  remains a future gate on a hypothetical DNA feature only. Naming it to close it.

**Non-US regimes that bite — only if we *collect from* or *serve* residents of these places (governing
law follows the subject, not our HQ):**

- **EU/UK GDPR** — a face image processed to derive skin attributes is Art. 9 *special-category
  biometric data*; needs explicit consent, purpose limitation, data-subject rights (incl. erasure),
  and a lawful transfer mechanism to move it to US training infra.
- **EU AI Act Art. 5(1)(g)** — prohibits biometric categorisation systems that infer **race or
  ethnicity**. Skin-tone / Fitzpatrick labeling sits dangerously close to that line and is a specific
  counsel question, not a hand-wave, before we label a single EU-subject image.
- **China PIPL** — biometric is "sensitive personal information": separate consent + a **cross-border
  transfer** gate (security assessment / SCC filing / certification) plus the 2025 face-recognition
  provisions. This can be a **hard blocker on ever moving Chinese-subject images to US training
  infra**, independent of consent quality.
- **India DPDP Act 2023** — consent-based; face data is personal data with recent sensitive-data rules.
- **South Africa POPIA** — biometric is "special personal information"; explicit consent required.
- **Nigeria NDPA 2023 / Kenya DPA 2019** — biometric is sensitive personal data; consent required;
  Kenya adds localization friction for some transfers.
- (Secondary, if geography shifts: **Brazil LGPD**, **South Korea PIPA**, **Japan APPI** — all treat
  biometric as sensitive/requiring separate consent.)

**Key structural point for the non-US question:** a corpus *collected under valid consent* is lawful
for us to *use* globally. The exposure is in the **act of collection and cross-border transfer**, and
that is set by where the subjects are. A US-sourced licensed corpus (Option A) sidesteps every non-US
collection regime; collecting in Asia/Africa (Option B or D there) pulls in PIPL/POPIA/DPDP and, for
China, a possible transfer wall.

---

## 4. The options

### Option A — Licensed commercial dataset *(recommended primary)*

Buy a consent-verified, Fitzpatrick-balanced corpus from a vendor whose collection carried explicit
biometric/ML-training consent (dataset-requirements-brief §4.1).

- **Consent instrument:** the *vendor's* signed biometric + ML-training consent chain, warranted to us
  by contract. We satisfy L1–L7 by diligence on the vendor's paperwork, not by running our own flow.
- **Regimes satisfied / not:** satisfies BIPA §15(b) *iff* the vendor's consent expressly covers
  biometric analysis **and commercial ML training** (L1) — "research use" does not count. MHMDA covered
  if WA subjects are warranted-consented. Non-US regimes are the **vendor's** collection burden, not
  ours — but we still need contractual warranties of lawful provenance and no scraped data (L4; the
  Clearview fact pattern is indefensible).
- **Architecture change:** **none to the scan path.** We stand up a **governed offline training-data
  store beside the app** (encrypted, access-controlled, disjoint from prod and from `eval/fairness/`
  per T6). This *is* server-side image retention, but of *vendor* images under license — an accepted,
  bounded new obligation, not a breach of the on-device promise.
- **Retention/deletion:** publish a training-corpus retention schedule (BIPA §15(a)); delete at end of
  the training+validation window; contract must give us the *right to retain* for that window (L5).
- **Revocation:** subjects revoke to the *vendor*; we need a contractual **deletion-propagation clause**
  obliging the vendor to notify us and us to purge. Raises the "model already trained on later-deleted
  data" question — counsel (§6).
- **Two-principal camera cap:** **not implicated** — our camera is never used. Cap stays intact.
- **Counsel-only questions:** does the vendor's actual consent text reach commercial ML training (not
  just research)? Are IV–VI subjects genuinely consented and balanced, or is "diverse" still I–III-
  heavy? Does the vendor warrant US-lawful, non-scraped provenance? Deletion-propagation + trained-on-
  deleted-data handling.
- **Cost shape:** five-figure license (dataset-requirements-brief §4.1); fastest clean path.

### Option B — Commissioned collection *(recommended IV–VI top-up)*

An agency recruits paid, consenting adults under **our** counsel-drafted consent form, with IV–VI
balance specified up front (dataset-requirements-brief §4.2).

- **Consent instrument:** **ours** — exactly the L1–L7 language we want, signed by each participant.
  Strongest consent quality; also the most work.
- **Regimes satisfied / not:** if collected **in the US**, cleanly satisfies BIPA/MHMDA because we
  author the form. If collected **in Asia/Africa to reach IV–VI** (the likely reason to commission),
  local law governs the collection: PIPL / POPIA / DPDP / NDPA consent **and** cross-border transfer
  rules attach, and **China PIPL transfer may block bringing images to US infra at all** (§3).
- **Architecture change:** same as A — a governed offline training store beside the app; **no scan-path
  change** *provided capture runs on the agency's tooling, not our app build.* If it ran on our app,
  see the cap row.
- **Retention/deletion:** our schedule, our deletion job; deletion must propagate to the corpus and
  backups on a defined cycle (training-approach-brief §6.2).
- **Revocation:** our form must grant withdrawal; we execute the purge. Same trained-on-deleted-data
  open question.
- **Two-principal camera cap:** **intact if the agency uses its own capture tooling** (recommended).
  **Requires widening if we insist on capturing through our own app** across many recruited
  participants — that would be a supervised-collection build distributed beyond two principals, which
  the standing rule forbids for camera builds; do not go there to save vendor cost.
- **Counsel-only questions:** which collection geography (drives which non-US regime applies and
  whether transfer is even lawful)? Our consent form's sufficiency under each target regime; paid-
  participant consent-validity (informed vs. merely compensated, L7); export/transfer mechanism.
- **Cost shape:** slower, likely costlier than A; consent instrument is exactly ours.

### Option C — Academic / open datasets *(not recommended)*

Fitzpatrick17k, SCIN, DDI, or untagged face corpora (dataset-requirements-brief §4.3;
training-approach-brief §5.2).

- **Consent instrument:** whatever the dataset shipped with — almost always **research-use-only**
  (fails L1/L2) or **scraped** (fails L4). No instrument we can stand behind commercially.
- **Regimes satisfied / not:** typically fails the BIPA §15(b) *commercial* consent bar on its face.
- **Intended-use landmine (the decisive one):** the Fitzpatrick-labeled sets are **clinical dermatology
  corpora labeled with diseases**. Training on eczema/rosacea/melanoma images creates a documentary
  record that the system was *built to recognize disease* — evidence against our cosmetic-not-medical
  position under the intended-use doctrine, regardless of UI wording (training-approach-brief §5.2).
- **Architecture change / cap:** n/a — should not be acquired.
- **Counsel-only questions:** is any single set's license genuinely commercial-ML *and* free of
  disease-label provenance risk? Default assumption: no, until proven per-set.

### Option D — In-app user donation *(price it; do not build it)*

A separate opt-in "keep my scan to improve TrueTone" flow (training-approach-brief §6.1).

- **Consent instrument:** a **separate, unbundled, revocable** retain-my-scan consent, *distinct* from
  the scan consent (never bundled — §6.2). Higher bar than the current placeholder in
  `src/features/consent/consent-copy.ts`.
- **Regimes:** BIPA/MHMDA collection consent from real users, plus every non-US regime for wherever
  those users are — i.e. the launch geography directly, including PIPL transfer for Chinese users.
- **Architecture change — BREAKS THE RED LINE:** to retain a donated scan, the raw face image must be
  **uploaded and stored server-side**, which directly violates the standing "image never leaves the
  device, never uploaded/logged/cached" constraint and would trip the `check-no-image-egress` guard.
  This is **not a policy change; it is a core-architecture change** to the scan path itself, and it
  forfeits the cleanest part of our compliance story. Flagging plainly rather than assuming it.
- **Retention/deletion / revocation:** per-user withdrawal must purge the uploaded corpus + backups on
  a defined cycle; the trained-on-deleted-data question is sharpest here.
- **Two-principal camera cap:** **fully widened** — this is our app capturing and *retaining* from many
  real users, requiring a Tier-2 consented capture build on TestFlight/App Store, which the standing
  camera rule currently forbids. The largest change of any option.
- **Verdict:** most expensive, slowest to grow a corpus, lowest opt-in, and it spends our core
  architectural promise. Keep as a distant future option only, behind full counsel design.

---

## 5. Recommendation and the single cheapest reversible first step

**Recommendation:** pursue **Option A** (licensed, consent-verified, IV–VI-balanced), with **Option B**
as a US-collected top-up for whichever deep tones the base set under-covers. This gets real IV–VI
faces under a defensible instrument **without touching the scan-path architecture or the two-principal
camera cap**, and sidesteps the non-US collection regimes entirely (US-sourced) — the launch geography
then only affects where the *product* runs, not where images were lawfully collected. Explicitly
**not** Option C (consent + intended-use) and **not** Option D (breaks the on-device red line).

**Single cheapest reversible first step:**

> Send this memo to counsel with one concrete ask: turn the **L1–L7 requirements into a one-page
> consent/provenance term sheet**, then obtain **one candidate vendor's sample consent form + provenance
> warranties** and have counsel vet them against it — **before any money moves or any image is
> downloaded.** This commits nothing, retains nothing, and is fully reversible.

**Note before you spend (from training-approach-brief §4):** the genuinely-first move is free and is
*not* a consent question — **fix the fairness gap synthetically first** (`oiliness` is worst and
non-monotonic and is traceable to a specific formula). Collecting an expensive corpus to paper over a
hand-tuned-constant bug is the wrong order of operations; real data should *ground* a read that is
already fair in structure, not be asked to rescue one that isn't.

---

## 6. Open questions only counsel can answer

1. Does a given vendor's actual consent text reach **commercial ML training**, not merely "research"
   (L1)? This is the make-or-break clause for Option A/C.
2. **Trained-on-deleted-data:** if a subject later revokes, must a model already trained on their image
   be retrained, or is deletion of the source image sufficient? (Applies to A/B/D;
   training-approach-brief §6.2/§7.)
3. **EU AI Act Art. 5(1)(g):** does Fitzpatrick/skin-tone labeling constitute prohibited biometric
   categorisation inferring race/ethnicity? (Gates any EU-subject data.)
4. **China PIPL cross-border:** can Chinese-subject face images be transferred to US training infra at
   all, and under which mechanism? (Could be a hard wall on collecting in China for Option B/D.)
5. For Option B: which **collection geography**, and is our consent form sufficient under each target
   regime (US BIPA/MHMDA + local)?
6. Is the corpus retention schedule + deletion-propagation clause (A) / deletion job (B/D) adequate
   under BIPA §15(a) and each applicable non-US erasure right?
7. Does a licensed corpus require its own **App Privacy / policy disclosures**, given it never touches
   user devices? (Likely minimal, but confirm.)

---

*Engineering scoping memo, not legal advice. Counsel reviews the chosen instrument and dataset terms
before acquisition. No standing constraint is proposed for relaxation by this memo; Option D is
documented as a red-line breach precisely so it is priced, not assumed.*
