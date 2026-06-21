# Skin Appearance Age + Trend (premium) — Design

**Date:** 2026-06-21
**Status:** Approved design — pending implementation plan
**Build-order tie-in:** the Trend half *is* build-order step 7 (progress re-scan + honest trend loop).

> Compliance note (governs everything below): TrueTone is a **cosmetic / general-wellness**
> product, **not a medical device**. This feature describes how skin *looks*; it never diagnoses,
> never infers health/biological age, and the absolute number is an accuracy claim that **MUST NOT
> ship without validation data on file** (CLAUDE.md §1; FTC §5 + Illinois ICFA). Not legal advice;
> counsel reviews before launch.

---

## 1. Scope & the two halves

A premium, subscription-gated feature with two parts that ship on **different timelines**:

- **Skin Age Trend** *(ships now)* — within-user, **relative**: "your skin looks fresher than your
  last 3 scans." Makes no population claim, so it carries **no validation gate**. This is also
  build-order **step 7**, so we are delivering a planned milestone, not net-new surface area.
- **Skin Appearance Age** *(built now, dark until validated)* — **absolute**: "your skin looks like
  ~30." Engine + storage land behind a flag `SKIN_AGE_ABSOLUTE_ENABLED = false` that **stays off
  until validation data is on file**. Same dark-launch discipline already used for the real
  on-device executorch read.

**Out of scope (YAGNI):** biological / physiological / "real" age, any health-status or longevity
inference, anything implying disease or an aging *rate*. Vocabulary stays cosmetic-appearance only
and passes the existing disease-blocklist post-filter.

## 2. Compliance boundary (load-bearing)

```
ON DEVICE  → capture → on-device read → cosmetic scores  +  skin_age estimate (+ confidence)
                                    (raw image deleted here, AFTER age is computed)
─────────── boundary: only derived numbers cross — never the image ───────────
BACKEND    → Supabase: append skin_age to the scan's scores row (RLS-scoped, US region)
           → Trend derived from the user's OWN historical score rows
           → RevenueCat entitlement gates DISPLAY, never capture
```

- The age estimate is produced **on-device, in the same pass as the read, before image deletion** —
  it is just another derived score. The raw image never leaves the phone.
- **Billing never touches the scan path.** RevenueCat sees an entitlement boolean only — never face
  data, never scores.

## 3. Data model

One additive change — no new table, no new vendor:

- Add `skin_age_estimate` (int, **nullable**) and `skin_age_confidence` (float, **nullable**) to the
  **existing per-scan scores row**.
- Inherits all data-rights machinery automatically: **RLS** scoped to the owning user,
  **delete-everything**, and the **3-year retention / auto-deletion** job. Nullable so historical
  rows and the entire dark-flag period remain valid.
- **Trend** is a read-only derivation over the user's own last-N rows — no stored "trend" object to
  keep in sync.

## 4. Modules (small, isolated, host-testable)

- **`skin-age-engine`** *(on-device)* — `(read output) → { ageEstimate, confidence }`. Pure
  transform is host-testable; the model invocation is marked `// DEVICE-ONLY` exactly like the
  executorch read. Gated by `SKIN_AGE_ABSOLUTE_ENABLED`.
- **`skin-age-trend`** *(pure derivation)* — `(historical scores) → trend label/series`. 100%
  host-testable. **Ships on.**
- **`premium-entitlement`** — thin RevenueCat wrapper exposing `hasAgeAccess(): boolean`. Gates UI
  only; receives no scores or image.
- **UI** — a premium card on the result/home screen: the trend chart renders for subscribers; the
  absolute number renders only when the flag **and** validation are live. Copy is
  cosmetic-vocabulary and passes the post-filter.

## 5. Phasing

1. **Trend + paywall** — `skin-age-trend`, the scores-history query, RevenueCat entitlement, and the
   premium UI showing the trend. Fully shippable; no validation gate. *(= build-order step 7.)*
2. **Absolute engine, dark** — `skin-age-engine` on-device + the `skin_age` columns, flag **off**.
   Built and host-tested; produces nothing user-visible.
3. **Validation → flip** *(separate track; founder + legal)* — run the balanced skin-tone test set
   as an age-validation study; when data is on file and signed off, flip the flag. **Not an
   engineering-only decision.**

## 6. Testing

- `skin-age-trend`: TDD unit tests across rising / falling / flat / sparse-history inputs (host).
- `skin-age-engine`: unit-test the pure transform; native call gated, device-verified later.
- `premium-entitlement`: free vs subscribed gating; **assert the billing path never receives scores
  or image**.
- Post-filter test: age copy emits only approved cosmetic descriptors.
- Fairness: the age estimate must hold across **Fitzpatrick I–VI** before any flip — reuse the
  fairness-eval harness.
- Target ≥80% coverage on the pure modules.

## 7. Escalation flags (founder + likely legal — CLAUDE.md §6)

Two items engineering will **not** decide unilaterally:

1. **Flipping `SKIN_AGE_ABSOLUTE_ENABLED`** — requires validation data on file. Hard gate.
2. **Final user-facing wording** of the age number — must read as cosmetic appearance, never a
   health / biological / aging-rate claim.

---

## Definition of done (per CLAUDE.md §7)

- [ ] No raw image persisted server-side; image deleted after the read (age computed before deletion).
- [ ] No new SDK/vendor with access to face/health data (RevenueCat sees entitlement only).
- [ ] Age copy passes the cosmetic-vocabulary post-filter (no disease terms).
- [ ] Gated behind the 18+ gate and logged consent screen (inherited from the scan path).
- [ ] `skin_age` columns covered by delete-everything + the retention/auto-deletion job.
- [ ] Encrypted in transit + at rest; RLS scoped to the owning user.
- [ ] Absolute number stays dark until validation data is on file and signed off.
