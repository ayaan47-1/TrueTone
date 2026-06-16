# TrueTone — Legal & Regulatory Compliance Spec (Developer Build Requirements)

> **Purpose:** This file is written to be ingested by a coding assistant and a human developer.
> It defines hard requirements for building TrueTone (an AI skin-appearance app) compliantly.
> **This is engineering/compliance guidance, NOT legal advice.** A licensed Illinois privacy/biometric
> attorney (and ideally an FDA/advertising advisor) MUST review before public launch.
>
> **Keyword convention (RFC-style):** `MUST` = hard requirement / launch blocker · `MUST NOT` = prohibited,
> creates legal exposure · `SHOULD` = strong recommendation.
>
> **Build context:** Company located in Illinois, USA. Product = cosmetic / general-wellness app.
> Target stores: Apple App Store (also applies generally to Android/Google Play).

---

## 0. THE GOVERNING PRINCIPLE (read first)

TrueTone is a **cosmetic / general-wellness product. It is NOT a medical device and NEVER diagnoses anything.**
US regulators classify software by its *intended use*, which is established by the **claims and wording**
in the UI and model outputs. Every requirement below exists to keep TrueTone on the cosmetic side of that line.

Three commitments, enforced in code:
1. Describe how skin **LOOKS** (appearance). Never state/imply a medical diagnosis.
2. Recommend **OTC cosmetic care and habits**. Never claim to treat/cure/prevent disease or change skin structure/function.
3. When something looks medically concerning, **redirect to a dermatologist — never diagnose.**

If any feature request would break these, STOP and escalate to the founders.

---

## 1. FDA — DO NOT BECOME A MEDICAL DEVICE

General-wellness software unrelated to diagnosing/treating disease is excluded from the FDA "device"
definition (FD&C Act §520(o)(1)(B); FDA Jan 2026 General Wellness guidance). Using the camera as a
*diagnostic tool*, or giving disease diagnosis/treatment, makes it a regulated device.

**MUST**
- Limit analysis output to cosmetic attributes: hydration *look*, oiliness, visible texture, pores,
  appearance of dark spots / redness / fine lines / dark circles; and cosmetic skin *type*
  (dry / oily / combination / sensitive-feeling).
- Constrain the analysis model via system prompt + output schema + post-filter so it can ONLY return
  approved cosmetic descriptors (see §2 vocabulary).
- Hard-blocklist disease names and any diagnostic phrasing from all user-facing output.
- Hard-refuse mole/lesion/"cancer"/"melanoma" assessment requests → return the dermatologist referral,
  regardless of how the user phrases it.

**MUST NOT**
- Output a disease diagnosis ("you have acne / rosacea / eczema / melasma / skin cancer").
- Detect, screen, triage, or risk-assess any disease or skin lesion (NO mole/cancer checking, ever).
- Claim to treat, cure, prevent, heal, or "clear up" a condition.
- Claim to change skin structure/function ("boosts collagen", "repairs the barrier", "shrinks pores").
- Imply medical/clinical-grade accuracy or that the app replaces a doctor.

---

## 2. CLAIMS & LANGUAGE LIBRARY (FTC + FDA)

The FTC (Section 5) requires every objective claim to be truthful and **substantiated before it is made**
(this includes "AI" claims). The FDA cosmetic-vs-drug line means any treat-disease or structure/function
claim becomes an illegal unapproved "drug" claim. Satisfy both.

### 2.1 Approved vs prohibited wording — treat the right column as a BLOCKLIST

| USE (cosmetic / appearance) | NEVER (drug / disease / unsubstantiated) |
|---|---|
| "Your skin looks dehydrated." | "You have dehydration / a barrier disorder." |
| "The appearance of blemishes / breakouts." | "Your acne" / "we'll treat your acne." |
| "Improves the look of fine lines." | "Reduces wrinkles" / "boosts collagen." |
| "Helps skin look more even-toned." | "Treats melasma / hyperpigmentation disorder." |
| "Soothes the look of redness." | "Treats / cures rosacea." |
| "A gentle exfoliant may help." | "This will clear / heal your condition." |
| "Consider seeing a dermatologist." | "This looks like [disease] / could be cancer." |
| "AI-powered skin-appearance analysis." | "Dermatologist-level / clinically proven" (without proof). |

Rule of thumb: **"improves the look of X" = OK; "treats / fixes / boosts / repairs X" = drug claim = prohibited.**

### 2.2 Substantiation (FTC)
- **MUST NOT** publish any statistic or efficacy claim we cannot back with data. Avoid invented stats in v0.
- **MUST NOT** use "clinically proven", "dermatologist-level", "medically validated", "accurate" unless
  literally true and documented. Prefer "AI-powered skin-appearance analysis".
- The skin-tone-fairness/equity claim is a claim: **MUST** have internal validation data before marketing it.
- Testimonials/endorsements **MUST** be genuine, typical, and disclose material connections. No fake reviews.

### 2.3 Required standing disclaimers (ship in-app: onboarding + results screen + Terms)
- Not-a-medical-device / no-diagnosis disclaimer.
- See-a-dermatologist prompt.
- AI-limitations note (results are appearance estimates; lighting/image quality affect them).
(Exact strings in §8.)

---

## 3. BIOMETRIC PRIVACY — HIGHEST RISK (Illinois BIPA + others)

A scan mapping facial geometry = **biometric data**. Built in Illinois → **BIPA** applies, and BIPA gives
individuals a private right to sue with no proof of harm. **This cannot be retrofitted — build it first.**

### 3.1 Illinois BIPA (740 ILCS 14/15) → build requirements
- **§15(b) — Informed written consent BEFORE collection (MUST):** standalone consent screen before the
  first scan, stating what biometric data is collected, the specific purpose, and retention period;
  explicit opt-in (affirmative tap / e-signature OK). **Log consent** (timestamp + policy version).
- **§15(a) — Public retention & destruction policy (MUST):** publish a retention schedule; destroy
  biometric data when its purpose is met OR within **3 years of the user's last interaction**, whichever
  is first. Implement an **automated deletion job** to enforce it.
- **§15(c) — No sale/profit (MUST NOT):** never sell, lease, trade, or profit from biometric data.
- **§15(d) — No disclosure without consent (MUST NOT):** don't share biometric data with third parties
  without separate consent (or legal compulsion).
- **§15(e) — Reasonable security (MUST):** encrypt in transit + at rest; access controls; verified deletion.

**Penalty context:** $1,000/person (negligent) or $5,000/person (reckless) + attorneys' fees; 5-yr SOL.
(Facebook settled a BIPA face case for $650M.)

### 3.2 Other jurisdictions
- **Texas CUBI:** notice + consent before commercial capture; destroy ≤1 yr after purpose ends; AG-only
  enforcement ($25k/violation; Meta paid $1.4B).
- **Washington My Health My Data Act:** broad "consumer health data" includes biometric data and imagery
  *from which a template can be extracted* (a skin selfie likely qualifies). Requires consent, a SEPARATE
  standalone consumer-health-data privacy policy, signed authorization to sell, and has a **private right
  of action**. Treat as a second BIPA.
- **~20 comprehensive state privacy laws** (CA CCPA/CPRA, VA, CO, CT, TX, OR, …): biometric/health =
  **sensitive** → opt-in consent (CA: opt-out + limits) + access/delete/correct rights.
- **GDPR (EU):** biometric/health = special category (Art. 9), needs explicit consent. **SHOULD geo-restrict
  v0 to the US** to defer GDPR.

### 3.3 Simplifying strategy (DO THIS)
Build **one** flow to the strictest common denominator (BIPA + WA MHMDA) and apply it to **every** user
regardless of state: explicit opt-in consent before capture → data minimization → no sale → no third-party
sharing of biometric/health data → published retention schedule with enforced auto-deletion → in-app
access/delete. One flow ≈ compliant across all US jurisdictions.

---

## 4. DATA PRIVACY & SECURITY

### 4.1 The ad/analytics-SDK trap (how similar apps got fined)
FTC **Health Breach Notification Rule** (amended, eff. 2024-07-29) covers non-HIPAA health/wellness apps
and counts **unauthorized disclosure** (e.g., leaking data to ad/analytics SDKs/pixels) as a reportable
breach. Enforcement: GoodRx, BetterHelp, Premom, Flo.
- **MUST NOT** embed third-party advertising/analytics SDKs that can access face images, skin data, scan
  results, or health inferences (no Meta Pixel / ad-network SDKs touching this data).
- **MUST NOT** share/sell skin/face/health data to data brokers or ad platforms (also BIPA §15(c)).
- Any analytics **MUST** be privacy-preserving, exclude health/biometric data, be disclosed, and honor ATT.
- **MUST** honor your own privacy promises exactly (broken promise = FTC §5 deception).
- **MUST** have a breach-response plan ready (notify users, FTC, sometimes media).

### 4.2 Engineering practices
- **Data minimization (MUST):** collect only what's needed; **prefer deriving scores then discarding the
  raw face image.**
- **On-device / ephemeral processing (SHOULD, strongly):** if the raw image never leaves the device or is
  deleted right after analysis, BIPA/MHMDA/HBNR exposure drops sharply. Safest + most marketable.
- **Encryption (MUST):** TLS in transit; at-rest encryption for any stored image/template/result.
- **User rights (MUST):** in-app view + one-tap delete-everything (purges biometric data incl. backups on a
  defined cycle).
- **Retention enforcement (MUST):** automated deletion job implementing the published schedule.
- **Vendor diligence (MUST):** any model/API vendor processing face data MUST be contractually barred from
  reusing it, and disclosed in the privacy policy.

---

## 5. CHILDREN'S DATA (COPPA) → GATE TO 18+

COPPA (amended 2025–26) now classifies **biometric identifiers incl. facial patterns** as children's
"personal information" and requires **verifiable parental consent** for under-13s. BIPA applies regardless
of age (minors can't validly self-consent). Minors' face data = highest liability.

- **MUST** restrict v0 to users **18+**.
- **MUST** implement a real age gate (neutral DOB entry, not a checkbox) before any camera access; block
  under-18; never store under-18 face data.
- **MUST NOT** design or market to minors (no child-directed styling that would make it "child-directed" or
  "mixed-audience" under COPPA).
- Serving under-18s later would require verifiable parental consent + minor data minimization + legal
  review (a project, not a toggle).

**Coder rule:** No face scan is captured/processed/stored for anyone who hasn't passed the 18+ age gate.
Age verification is a precondition to the camera screen.

---

## 6. APPLE APP STORE REVIEW

| Guideline | Requirement for TrueTone |
|---|---|
| **1.4.1** Medical apps | Diagnose/treat or inaccurate-info apps get scrutiny / rejection. **Present as cosmetic/wellness, not medical;** clearly state methodology + that outputs are appearance estimates. No diagnosis. |
| **5.1.1(i)** Privacy policy + consent | Camera/Photos/ARKit-face apps **MUST** have a privacy policy + obtain consent. Provide both; reachable before first scan. |
| **5.1.1(v)** Account deletion | If accounts exist, **MUST** allow in-app initiation of full account + data deletion (deactivation insufficient). |
| **5.1.1(ix)** Regulated/sensitive data | May require an **Organization** developer account (not Individual) + proof of legitimacy. **Enroll the company (LLC) as an Organization.** |
| **5.1.2** Permission & transparency | No accessing/transmitting personal data without permission + clear use explanation. Provide purpose strings + just-in-time prompts. |
| **5.1.3** Health data | Health-context data **MUST NOT** be used for ads/marketing/data-mining or shared for those purposes. |
| **App Privacy labels + ATT** | Declare ALL collected data (incl. via SDKs) truthfully; implement ATT if anything tracks across apps. Best path: collect minimally. |
| **AI transparency (2026)** | Explain AI/automated features + their limits in plain language. |

**Face-data specifics**
- **SHOULD** use the standard camera (a selfie photo) rather than TrueDepth/ARKit face-mesh. If ARKit/
  TrueDepth face data is used, Apple restricts it (no advertising/identity use; keep tied to the feature;
  don't send off-device for those purposes). A plain photo avoids these extra restrictions.
- Provide specific permission purpose strings (§8).

---

## 7. BUILD CHECKLIST (turn into tickets)

**Onboarding & gating (before any camera access)**
- [ ] 18+ age gate (neutral DOB); block under-18; no under-18 face data.
- [ ] Standalone biometric consent screen before first scan; explicit opt-in; consent logged (timestamp + version).
- [ ] Privacy Policy + Terms reachable before the scan.
- [ ] Camera/Photos permission prompts with purpose strings (§8).

**Scan & results**
- [ ] Guided capture → cosmetic scores; SHOULD discard raw image after analysis (or store encrypted, only with consent).
- [ ] Output limited to approved cosmetic vocabulary (§2); disease terms blocklisted.
- [ ] Standing disclaimer accessible on results (not-medical + see-a-doctor + AI-limits).
- [ ] Dermatologist-referral path for unusual results; never a diagnosis.

**Privacy, data rights & security**
- [ ] In-app "Your Data": view stored data; one-tap delete-everything (purges biometric data + backups on a cycle).
- [ ] In-app account deletion (Apple 5.1.1(v)).
- [ ] Automated retention/auto-deletion job (BIPA: purpose-met or 3 yrs).
- [ ] Encryption in transit + at rest; NO health/biometric data in any ad/analytics SDK.
- [ ] No selling/sharing biometric/health data to third parties.

**Account & store setup (non-code, required)**
- [ ] Enroll company as an Apple **Organization** (5.1.1(ix)).
- [ ] Publish: main Privacy Policy; standalone **Biometric Data Policy** w/ retention schedule; WA
      consumer-health-data policy (if serving WA); Terms w/ disclaimers.
- [ ] Complete App Privacy "nutrition labels" truthfully (incl. any SDK data).
- [ ] Geo-restrict v0 to the US (defer GDPR) [SHOULD].

---

## 8. COPY-PASTE BLOCKS (use near-verbatim; counsel to review)

### iOS permission purpose strings (Info.plist)
```
NSCameraUsageDescription =
  "TrueTone uses your camera to take a photo of your skin so the app can estimate its
   visible appearance and suggest a cosmetic skincare routine. Your image is processed
   for analysis and is not sold or shared."

NSPhotoLibraryUsageDescription =
  "TrueTone accesses a photo you choose so it can estimate your skin's visible appearance.
   Photos are used only for analysis, never sold."
```

### Biometric consent screen (shown before first scan)
```
Before we scan your skin

To analyze your skin's appearance, TrueTone captures a photo of your face and measures
visible features of your skin (a "biometric identifier" under laws like Illinois' BIPA).

 • Purpose: to estimate your skin's appearance and suggest a cosmetic routine.
 • We do NOT sell, lease, or trade this data, ever.
 • We delete it when its purpose is met or within 3 years of your last use, whichever
   comes first — and anytime you tap "Delete My Data."

[ ] I have read the Biometric Data Policy and consent to TrueTone collecting and storing
    my biometric data as described.

        [ Decline ]            [ I Consent ]
```

### Standing disclaimer (results screen + Terms)
```
TrueTone is a cosmetic and general-wellness tool. It is not a medical device, does not
diagnose, treat, or prevent any disease or condition, and is not a substitute for
professional medical advice. Results are AI-generated estimates of your skin's appearance
and may be affected by lighting and image quality. For any skin concern — or any new,
changing, or unusual spot — please consult a board-certified dermatologist.
```

### Analysis-model system-prompt constraints (apply to the AI that reads the skin)
```
You analyze the COSMETIC APPEARANCE of skin only. You are NOT a medical tool.
- Only describe visible appearance using approved cosmetic terms (hydration look, oiliness,
  texture, pores, appearance of dark spots/redness/fine lines/dark circles; skin type).
- NEVER name, diagnose, or imply any disease/condition (e.g., acne, rosacea, eczema,
  melasma, dermatitis, skin cancer, melanoma).
- NEVER assess moles/lesions or cancer risk. If asked, refuse and recommend a dermatologist.
- NEVER claim to treat/cure/prevent disease or to change skin structure/function.
- Use hedged appearance language: "looks", "appears", "the appearance of".
- For anything unusual/concerning, output the dermatologist-referral message, not a diagnosis.
```

### Privacy-policy must-include checklist
- What is collected (face image, derived skin metrics, account info) + specific purpose.
- That facial data is a biometric identifier; retention schedule + destruction timeline.
- Explicit statement that biometric/health data is never sold/leased/traded/shared for ads.
- Third-party processors (e.g., analysis vendor) + that they may not reuse the data.
- User rights + how to exercise: access, delete, withdraw consent.
- Security measures; breach-notification commitment; privacy contact.
- A SEPARATE standalone Biometric Data Policy (BIPA); + consumer-health-data policy if serving WA.

---

## 9. PRE-LAUNCH LEGAL CHECKLIST (before public launch)
- [ ] Retain an **Illinois-licensed privacy/biometric attorney** to review consent flow, biometric policy,
      retention schedule, privacy policy. (Highest-ROI legal spend.)
- [ ] Have claims/UI copy reviewed vs FDA cosmetic-vs-drug + FTC substantiation.
- [ ] Form the company (LLC/Corp); enroll as Apple **Organization**; route data contracts through the entity.
- [ ] Sign data-processing agreements w/ every vendor touching face data (no reuse).
- [ ] Stand up the breach-response plan (HBNR timelines) + security program docs.
- [ ] Decide geo scope (US-only for v0 recommended); configure age gate + geo-gating.
- [ ] Keep records: consent logs, skin-tone-fairness validation data, policy versions.

---

## 30-SECOND SUMMARY
Cosmetic language only, never a diagnosis. Explicit opt-in consent before any scan, to the BIPA + Washington
standard, for everyone. Minimize and ideally delete the raw image; never let face/health data near an ad or
analytics SDK; never sell it. 18+ only. In-app delete + account deletion. Organization developer account.
Real privacy policy + standalone biometric policy. Then have a lawyer check it before launch.

---

*Sources (current to mid-2026; verify against live texts + counsel): FDA General Wellness Policy for Low-Risk
Devices (Jan 2026); FD&C Act §201(g)/§520(o); FDA cosmetic-vs-drug guidance; FTC Act §5; FTC Health Breach
Notification Rule (amended, eff. 2024-07-29) + enforcement (GoodRx, BetterHelp, Premom, Flo); Illinois BIPA
740 ILCS 14 (incl. 2024 amendment); Texas CUBI; Washington My Health My Data Act + RCW 19.375; state
comprehensive privacy laws (CCPA/CPRA, VA, CO, CT, TX, OR, et al.); FTC COPPA Rule 2025 amendments; Apple App
Store Review Guidelines 1.4.1 / 5.1.1 / 5.1.2 / 5.1.3 + App Privacy + account-deletion; GDPR Art. 9. NOT legal
advice.*
