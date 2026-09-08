# Apple Developer **Organization** Enrollment — Checklist

> **Why this exists:** TrueTone is iOS-primary and handles sensitive face/skin data, so Apple must
> see an **Organization** account (not Individual) — required for sensitive-data apps (`CLAUDE.md`
> §4). Enrollment as an Organization requires a legal entity + a **D-U-N-S Number**, which has lead
> time. **This gates ALL on-device testing** (TestFlight, device builds) and therefore the entire
> P2 Phase 4 (camera + on-device read). Start it early — it is the long pole.
>
> Owner: founders (legal-authority signer). Engineering can't complete this — it needs the legal
> entity and a person with authority to bind the company. Verified against Apple's docs 2026-06-16
> (see Sources); reconfirm specifics on developer.apple.com, as Apple changes details.

---

## Critical path (do the slow, blocking items first)

These three have external lead time and block everything after them. Kick them off in parallel today.

- [ ] **1. Confirm the legal entity (LLC).** Apple requires a real legal entity (corporation, LP, or
      **LLC**) that can sign contracts. **DBAs, fictitious/trade names, and branches are NOT
      accepted** — the legal entity name becomes the App Store "Seller" name. TrueTone is an Illinois
      company; confirm the IL LLC is formed and in good standing, and note the **exact registered
      legal name** (it must match the D-U-N-S record and Apple enrollment exactly).
      → If the LLC isn't formed yet, this is the first blocker; everything else waits on it.

- [ ] **2. Get a D-U-N-S Number** registered to the legal entity. Free in most jurisdictions, assigned
      by Dun & Bradstreet. **Allow up to ~5 business days** after requesting (can be longer).
      - [ ] First, look up whether the LLC already has one (Apple's enrollment flow + D&B both let you
            check) — avoid creating a duplicate.
      - [ ] If not, request a free D-U-N-S via Apple's lookup/D&B; ensure the registered **name +
            address** match the LLC exactly (mismatches are the #1 cause of enrollment delays).

- [ ] **3. Stand up a real company website + domain email.** Apple verifies an Organization against a
      **publicly available, functional website on the company's own domain**, and requires a **work
      email on that domain** for the enrolling person.
      - [ ] Register the company domain (if not already).
      - [ ] Publish a real site (more than a placeholder). **NOT accepted:** social-media pages, sites
            with minimal content, or a domain-registrar parking page.
      - [ ] Create a domain email for the signer (e.g. `founder@<company-domain>`).

---

## Enrollment prerequisites (person + account)

- [ ] **4. Identify the binding-authority signer.** The person enrolling must have **legal authority
      to bind the organization** — owner/founder, executive, senior project lead, or an employee
      granted authority by a senior employee. If the enroller is **not** the owner/founder, Apple
      requires a **reference who can confirm** that authority during verification.

- [ ] **5. Apple Account with two-factor authentication ON**, owned by the signer, who must be the
      legal age of majority. Use a **company-controlled** Apple Account (tied to the domain email),
      **not** a personal one — this account will own the org's App Store Connect / certificates.
      - [ ] Turn on 2FA.
      - [ ] (Recommended) Use the domain work email as the Apple Account, so account + enrollment
            email match the organization.

- [ ] **6. Prepare identity-verification materials.** Apple's org verification may request:
      - [ ] Government/photo ID of the signer (in some cases).
      - [ ] **Notarized business documents** certifying copies are true (varies by region —
            municipal office / solicitor / notary public). Have formation docs handy.
      - [ ] Binding-authority reference contact (from step 4) reachable to confirm.

---

## Submit & complete enrollment

- [ ] **7. Enroll** via the Apple Developer app or the web (developer.apple.com/enroll). Provide:
      legal entity name, D-U-N-S Number, company website, work email, and the signer's details.
- [ ] **8. Pass identity verification** (D-U-N-S + binding-authority check; possibly notarized docs).
      Respond promptly to any Apple Developer Support follow-ups — this is where timelines stretch.
- [ ] **9. Review & accept** the Apple Developer Program License Agreement.
- [ ] **10. Pay the annual fee — 99 USD** (Apple Developer Program; local currency where available).
      Payment is taken **after** Apple verifies the org and sends next steps.
- [ ] **11. Confirm activation:** the account shows as an **Organization** (Seller = legal entity
      name) in App Store Connect, and App Store Connect access works.

---

## What this unblocks (the reason we're doing it)

Once the Organization account is active:

- [ ] Create an **EAS / Apple Developer** signing identity and an **Expo dev build**.
- [ ] Install the dev build on a **physical iPhone** (Simulator has no camera).
- [ ] Begin **P2 Phase 4** task-by-task from the handoff in
      `docs/superpowers/plans/2026-06-16-truetone-p2-guided-capture.md` (native executorch read,
      `Capture` UI, scan routes), then TestFlight.

---

## TrueTone-specific App Review notes (line these up in parallel — they gate the *first submission*, not enrollment)

A face/skin app is reviewed under the **medical-apps** lens, so present it as **cosmetic/wellness,
never diagnostic** (`CLAUDE.md` §0, §4). These don't block enrollment but avoid a rejection later:

- [ ] **In-app account + data deletion** must exist and be reachable — already built in P1
      (`delete_account` / `delete_my_data`, data-rights screens). Keep it working.
- [ ] **Truthful App Privacy "nutrition labels"** — reflect that the **face image never leaves the
      device** and only derived scores are stored; declare no tracking SDKs (matches our
      `check:compliance` guard).
- [ ] **Specific camera permission purpose string** (vague strings get rejected) — already drafted in
      the Phase 4 plan (Task 0.1 `NSCameraUsageDescription`).
- [ ] **No ATT prompt** is the goal — our minimize-everything design avoids cross-app tracking. Only
      add ATT if something tracks across apps (it must not, per `CLAUDE.md` §1).
- [ ] **No accuracy / efficacy / skin-tone-equity claims** in the App Store listing or screenshots
      without validation data on file (FTC §5 / ICFA; the real-model + fairness sub-project owns that).

---

## Rough timeline / sequencing

```
LLC formed (if not already)  ─┐
D-U-N-S request → ~5+ business days ─┼─ parallel, all blocking
Website + domain email live  ─┘
        ↓
Apple Account (2FA) + signer/binding-authority ready
        ↓
Submit enrollment → identity verification (variable; Apple doesn't publish a SLA — can be days to weeks)
        ↓
Accept agreement → pay $99 → Organization account active
        ↓
EAS signing + Expo dev build on a physical iPhone → P2 Phase 4 begins
```

The two unpredictable waits are **D-U-N-S issuance** and **Apple's identity verification** — both are
outside our control, which is exactly why `CLAUDE.md` §4 says start early.

---

## Submitting a build to TestFlight (`eas submit`)

**TestFlight/App Store Connect requires a `distribution: "store"` (App Store signed) build —
it rejects the Ad Hoc `preview` profile's IPA at upload.** The `preview` build profile stays
`distribution: "internal"` because it's still used for direct-install demo builds (no App Store
Connect involved); a separate `testflight-demo` build profile carries `distribution: "store"` so
its IPA is accepted. Both run the same demo runtime (`EXPO_PUBLIC_DEMO: "1"` — camera
structurally unreachable, `__DEV__` false) — only the code-signing target differs.

```bash
eas build -p ios --profile testflight-demo
eas submit -p ios --profile testflight-demo --latest
```

The `submit.testflight-demo` block in `eas.json` already has the two account-identifying values
filled in (`ascAppId`, `appleTeamId` — both public identifiers, not secrets); the three
credential fields are still **placeholders only** — no key is committed. Fill these in locally
(or via EAS environment variables/secrets — see `eas env:create`) before running submit:

| `eas.json` key | What it is | Where to get it |
|---|---|---|
| `ascAppId` | The app's numeric App Store Connect ID | Already set: `"6807728417"`. (App Store Connect → the app → General → App Information → "Apple ID", if it ever needs re-confirming.) |
| `appleTeamId` | The 10-character Apple Developer Team ID | Already set: `"J58R53HC5M"` — same value as `app.json → expo.ios.appleTeamId`. |
| `ascApiKeyPath` | Local path to an App Store Connect API key `.p8` file | App Store Connect → Users and Access → Integrations → App Store Connect API → generate a key, download the `.p8` **once** (Apple won't re-issue it) |
| `ascApiKeyId` | The key ID shown next to that key | same Integrations page |
| `ascApiKeyIssuerId` | The Issuer ID for the account (one per account, not per key) | same Integrations page, shown above the key list |

The API-key path is preferred over `appleId`/interactive login: it's non-interactive (works in CI
and doesn't need 2FA/app-specific-password juggling) and scoped to just what `eas submit` needs.
**For a first one-off submit, the API key can be skipped entirely**: delete the three
`ascApiKeyPath` / `ascApiKeyId` / `ascApiKeyIssuerId` placeholder lines from
`submit.testflight-demo.ios` (leave `ascAppId` + `appleTeamId`), then `eas submit -p ios
--profile testflight-demo` prompts for an interactive Apple ID login (2FA included) instead.
Leaving the placeholder *strings* in place will make `eas submit` try to read a `.p8` file that
doesn't exist and fail — the fields must be removed, not merely left unfilled, to get the
interactive fallback.

**Never commit the actual `.p8` key file or a real `ascApiKeyId`/`ascApiKeyIssuerId`** — keep the
key outside the repo (e.g. `~/.eas/AuthKey_XXXX.p8`) and point `ascApiKeyPath` at it locally, or
store the key via `eas credentials` / EAS secrets instead of a literal path in `eas.json`.

### `camera-demo` — a different profile, NOT a distribution path

`build.camera-demo` (`EXPO_PUBLIC_CAMERA_DEMO: "1"`) is the own-device live-camera prototype
(tt-cam-pipeline, Dwight's tt-cam-mode-ruling PASS). Unlike `testflight-demo`, it has **no
`submit.camera-demo` block** — deliberately: this mode must stay OFF in any build that could
reach another person's device (Dwight condition (e)), so it is built and installed straight to
one owned device (`eas build -p ios --profile camera-demo`, then a direct/local install), never
routed through App Store Connect. Friends-distribution is a separate, not-yet-unlocked effort
(needs server `consent_log`, lawyer-reviewed copy, real backend/ATS, and ASC 18+ rating).

## Sources

- [Enrollment — Apple Developer Help](https://developer.apple.com/help/account/membership/program-enrollment/)
- [Become a member — Apple Developer Program](https://developer.apple.com/programs/enroll/)
- [D-U-N-S Number — Apple Developer Help](https://developer.apple.com/help/account/membership/D-U-N-S/)
- [Identity verification — Apple Developer Help](https://developer.apple.com/help/account/membership/identity-verification/)
