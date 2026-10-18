# Policies for counsel review

Snapshot of the four public policies, copied from `src/content/` on main `4837521` (2026-10-18).
All four still carry "PLACEHOLDER — pending counsel review."

**Source of truth is `src/content/*.md`** (the app and truetone.skin/policies render those).
Make edits there, then re-copy here. Do not edit these copies alone.

| File | Policy | Live URL |
|---|---|---|
| `privacy.md` | Privacy Policy | https://truetone.skin/policies/privacy |
| `terms.md` | Terms of Use | https://truetone.skin/policies/terms |
| `biometric.md` | Biometric Data Policy (BIPA written policy) | https://truetone.skin/policies/biometric |
| `retention.md` | Data Retention Schedule | https://truetone.skin/policies/retention |

## Questions for counsel

**Policies**
1. Approve or redraft all four. Privacy still needs the exact commerce record categories and retention periods.
2. Biometric policy and retention schedule: confirm they meet BIPA (740 ILCS 14/15) written-policy and destruction-schedule requirements.

**App biometric consent (PR #64, consent posture A)**
3. Approve the consent text (`src/features/consent/consent-copy.ts`).
4. Grandfather existing consents or require re-consent. Note: switching old consents off triggers deletion of saved scans.
5. Confirm 7-day point-in-time backup recovery plus the daily deletion job meet the deletion promise.

**Shopify commerce** (detail: Dwight's ruling, "Founder/counsel launch gates")
6. Approve or reject Shopify Network Intelligence (required for Shopify Collective).
7. Washington My Health My Data Act: is a product chosen after a scan consumer health data, and does the requested-service exception apply?
8. Supplier content and media licence, and data roles of TrueTone, Shopify and suppliers.
9. App Store privacy answers and final disclosures.
10. Any product claim beyond plain identity facts (ingredients, size, shade, finish, price, availability).
