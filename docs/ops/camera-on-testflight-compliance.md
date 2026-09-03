# Compliance contract — camera-ON shade-match on private TestFlight

> **Status:** BINDING pre-implementation contract. Owner: Dwight (compliance guard).
> **Scope:** a build that turns the **live front camera ON**, captures a face frame,
> extracts skin tone **on-device**, runs `deriveShade`, shows a real shade + product
> picks, and **deletes the image on-device (no upload, no server copy of the image)** —
> distributed to a **handful of KNOWN testers** (cofounder + friends) via **private
> TestFlight (internal + small external group), NOT the public App Store.**
> **This is real biometric processing (Illinois BIPA / GIPA, WA MHMDA, FTC §5) running
> on third-party devices.** Every requirement below is a precondition, not a suggestion.
> Implementation (Pam/Roy) is GATED on this doc; `<Capture>` MUST NOT mount until every
> "MUST" here is satisfied.

This is engineering/compliance guidance current to 2026-09, **not legal advice.** The two
items flagged 🚩 LAWYER at the end MUST NOT reach a friend's device without counsel sign-off.

---

## 0. What changed vs the demo build we already cleared

The demo TestFlight build (Dwight PASS 2026-09-02, `EXPO_PUBLIC_DEMO=1`) was compliant
**only because it never turned the camera on**: `DEMO_MODE` stubbed a consented identity,
skipped the backend, and `/scan` was render-blocked. That clearance **does not transfer.**
Turning the camera on re-arms every BIPA obligation the demo sidestepped. The whole point
of this contract is that the age gate, the logged consent, and the on-device-delete
guarantee now have to actually run on real testers before a frame is ever captured.

| Dimension | Demo build (cleared) | Camera-ON build (this contract) |
|---|---|---|
| `EXPO_PUBLIC_DEMO` | `1` (stubs gates) | **`0` / unset — MUST** |
| EAS profile | `preview` (demo env) | `preview` or `production` — **NOT `development`** (see §4.4) |
| Backend | not required (stubbed) | **required UP** — consent + age flags are server-recorded |
| Age gate | skipped | **runs, blocks camera** |
| Consent | stubbed true | **real, written to immutable `consent_log`** |
| `/scan` camera | render-blocked | **mounts — only after gates pass** |
| ASC Age Assurance | No (4+) | **YES / 18+** (see §6) |

---

## 1. Age gate — 18+, neutral DOB, NOT made-for-kids

- **MUST** require **18+** via **neutral date-of-birth entry** (already implemented:
  `src/features/age-gate/AgeGate.tsx` → `computeIs18Plus`, `app/age-gate.tsx`). The DOB is
  used to compute eligibility and **discarded** — only `is_18_plus` + `age_verified_at` are
  stored (`profiles`). Keep it neutral: no "are you a kid?" framing, no COPPA/kids category.
- **MUST** sit **before the camera can mount**. It already does structurally: the root
  `Guard` in `app/_layout.tsx` runs `nextRoute()` (`src/lib/routing-guard.ts`) on every
  pathname, and `nextRoute` returns `'age-gate'` whenever `is18` is false — so no route,
  `/scan` included, renders until 18+ is recorded. **Do not** add any path that reaches
  `<Capture>` outside this gate chain.
- **Placement (exact):** `region-blocked (US only) → age-gate (18+) → consent → home`.
  Camera lives past `home`. The gate order is load-bearing; do not reorder.

## 2. Informed consent — before ANY camera access

- **MUST** present a **standalone biometric consent screen** and obtain an **affirmative
  action** (the existing checkbox + "I Consent"; consent button stays disabled until the
  box is ticked — `src/features/consent/Consent.tsx`). No pre-checked box, no bundling into
  a Terms blob, no "by continuing you agree."
- **Required copy points** (BIPA §15(b) + WA MHMDA), all four already scaffolded in
  `src/features/consent/consent-copy.ts` — **but the copy is marked PLACEHOLDER pending
  counsel and MUST be finalized before this build ships** (🚩 LAWYER #1, §8):
  1. **What** is collected — a face photo + measured visible skin features (a biometric
     identifier under BIPA).
  2. **Purpose** — to estimate skin appearance and match a cosmetic makeup shade. **Cosmetic
     only. No treatment / diagnosis / condition language** (CLAUDE.md §0/§1).
  3. **Retention & deletion** — the **photo is processed on-device and deleted immediately
     after the read; it is never uploaded or stored on a server.** Only the derived shade /
     cosmetic scores leave the device. Derived data is deleted on purpose-met or within
     **3 years of last use**, and anytime via Delete My Data.
  4. **Link** to the Biometric Data Policy, reachable **before** consent.
  > ⚠️ Copy-accuracy check: the current placeholder says the user consents to "collecting
  > and **storing** my biometric data." That must not read as "we store your photo on our
  > servers" — it doesn't. Reword to make the on-device/image-deleted reality unambiguous,
  > or it becomes an FTC §5 accuracy problem in the other direction.
- **Storage of consent:** consent is written to the **append-only `consent_log`** via the
  `record_consent` RPC (`supabase/migrations/0004_rpcs.sql`), which pins the **current
  biometric policy version** at time of consent. `consent_log` is immutable
  (`0003_consent_immutability.sql`: DELETE blocked, UPDATE blocked except de-identification)
  — it is the legal receipt. **MUST NOT** loosen it.
- **Revocation:** `withdraw_consent` RPC exists and flips `profiles.consent_active=false`,
  which sends the user back to the consent gate (camera re-locks). A revoke control **MUST**
  be reachable in-app (Data / You screen) for this build — revocability is a BIPA/MHMDA
  expectation, not optional once you're collecting from real people.

## 3. BIPA / GIPA / FTC posture for on-device-only + image-deleted

- **On-device-only is the entire legal basis.** The compliance boundary (CLAUDE.md §3)
  holds: capture → on-device tone extraction → `deriveShade` → **image deleted
  (`withImageCleanup`, `src/features/read/image-lifecycle.ts`)** → only derived scores
  cross to the backend. The raw frame MUST NOT be uploaded, logged, cached server-side, or
  sent to any third party — not even behind a flag "temporarily."
- **BIPA:** written consent + retention schedule + no sale/profit. Satisfied by §1–§2 +
  the retention job (`0005_retention_cron.sql`, `0009`) + the never-sell rule. **In-app
  retention/deletion notice is REQUIRED** — the consent screen's retention line + a
  reachable Biometric Data Policy + a working **Delete My Data** (`delete_my_data` RPC)
  together satisfy it. Confirm the policy screens are reachable pre-scan in this build.
- **GIPA:** **not in scope and MUST stay out.** No DNA/genetic data, no ancestry/genetic
  framing anywhere in copy. Hard gate.
- **WA MHMDA:** the shade read is consumer-health-adjacent; consent + no-sale + no third-party
  sharing without separate consent cover it. **No ad/analytics SDK on the scan path.**
- **FTC §5:** every user-facing string stays cosmetic. **No accuracy / efficacy /
  skin-tone-equity claim** ("exact shade", "works on every tone", any %) ships without
  validation data on file. Result screen is **shade NAME + product picks only** — no scores,
  no confidence %, no analysis readout (keeps it a cosmetic match, not a diagnostic readout).

## 4. Exact code preconditions before `<Capture>` may mount

All of these are **AND-ed**. If any is false, the camera MUST NOT mount.

1. **Gate chain cleared.** `nextRoute({isUS:true, is18:true, consent:true}) === 'home'`.
   `/scan` is only reachable when the root `Guard` has let the app past all gates. Do not
   introduce a `<Capture>` renderer outside the gated tree.
2. **`DEMO_MODE` is OFF.** `EXPO_PUBLIC_DEMO` unset/`0` so `profile-context` does the real
   backend load and the real gates run. A camera-ON build with DEMO on would stub consent —
   **forbidden.**
3. **Region = US.** `isUSRegion()` true (fail-closed: `null`/`false` → `region-blocked`).
4. **Build is NOT the `development` profile.** `development` sets `__DEV__=true`, which
   **un-fences the dev-only camera surfaces**: `app/(dev)/bbox-overlay.tsx` (guarded by
   `if (!__DEV__) return null;`) and `Capture`'s `devForceCapture` manual shutter. Ship on
   **`preview`** (internal/external TestFlight) or **`production`** so `__DEV__` is false and
   only the gated `/scan` path can reach the camera. **This is a hard precondition.**
5. **Camera permission** requested with the approved cosmetic purpose string
   (`app.json` `NSCameraUsageDescription` — "…never uploaded and is deleted right after the
   analysis"). Permission denial MUST leave the user in a non-capturing state, not crash.
6. **Backend reachable.** `record_consent` / `profiles` / `policy_versions` must resolve, and
   a **current biometric policy row must exist** (`policy_versions where doc_key='biometric'
   and is_current`) — `record_consent` raises "no current biometric policy" otherwise, which
   would block consent. Verify the row is seeded in the environment this build points at.

## 5. CI guards that MUST pass (do not weaken any to make a change pass)

Wired in `.github/workflows/compliance.yml` (runs on push + PR):

- **`npm run check:no-egress`** (`scripts/check-no-image-egress.mjs`) — fails if any of
  `.storage, upload, imageUri, photo.path, FormData` appears in `src/features/capture`,
  `src/features/read`, or `app/(dev)`. The camera-on capture→read→delete code lands exactly
  in these guarded dirs, so this is the primary mechanical proof the image doesn't leave.
  **Known false-positive:** the bare word "upload" in a **comment** has twice tripped it —
  if it fires on new capture code, read the diff first; the fix is almost always to reword
  the comment, **not** to touch the guard or its FORBIDDEN list.
- **`npm run check:compliance`** — no ad/analytics SDK reaches the data path; web marketing
  copy stays on the cosmetic side.
- **`npm test`** + **`npm run test:scripts`** — unit + node:test suites (gate logic,
  `nextRoute`, consent, image-lifecycle, compliance scripts).
- **Verify green before shipping:** run `gh run list --workflow=compliance.yml -L 1` on the
  build commit and confirm success. (Dwight could not verify from the sandbox — no network;
  this check is a merge-gate for whoever cuts the build.)

## 6. Apple App Store Connect age-rating deltas vs the demo answers

Demo answers were Medical=None, Wellness=Infrequent/Mild, **Age Assurance=No → 4+**. For the
**camera-ON build**, change:

- **In-App Controls → Age Assurance = YES**, **minimum age 18+.** The app now gates real
  biometric capture behind an 18+ requirement — declare it. Be ready for Apple's **Declared
  Age Range** follow-up; answer **18+**.
- **NOT made-for-kids / NOT COPPA** — keep the kids category off.
- **Medical or Wellness → Medical/Treatment Information = None** (unchanged — cosmetic, not
  medical; result is a shade name, no health readout). **Health/Wellness = Infrequent/Mild**
  only if mild wellness copy (mood chips/affirmations) is present; otherwise None.
- **Capabilities** all No (no web/UGC/social/chat/ads) — unchanged.
- Note: the content **rating** (4+/etc.) is separate from the in-app 18+ biometric gate; the
  gate in code governs face data regardless of the store rating.

## 7. Definition of done / sign-off checklist

Ship to testers only when **all** are checked:

- [ ] 18+ neutral-DOB age gate runs before camera; DOB not persisted.
- [ ] Standalone consent screen, affirmative opt-in, no pre-check; **finalized (non-placeholder)
      copy** with all four §2 points; Biometric Data Policy reachable pre-scan.
- [ ] Consent written to immutable `consent_log` via `record_consent` (policy version pinned);
      **revoke** control reachable in-app.
- [ ] `EXPO_PUBLIC_DEMO` OFF; build on `preview`/`production` (NOT `development`); US-region;
      backend up with a current `biometric` policy row.
- [ ] Raw image deleted on-device after read (`withImageCleanup`); **no** image upload/persist
      server-side; only derived shade crosses the boundary.
- [ ] Result screen = shade name + product picks only (no scores/%/analysis readout); no
      disease/treatment/accuracy/equity claim in any string.
- [ ] Delete My Data + account deletion work; RLS scopes each user's rows; TLS + at-rest
      encryption on the derived data.
- [ ] `check:no-egress`, `check:compliance`, `npm test`, `test:scripts` all green on the build
      commit (`gh run list`).
- [ ] ASC: Age Assurance = YES / 18+, Medical = None.
- [ ] 🚩 LAWYER items (§8) signed off.

## 8. 🚩 FLAG — MUST NOT ship to friends' devices without a lawyer

1. **Final biometric consent + Biometric Data Policy copy.** `consent-copy.ts` is explicitly
   a **PLACEHOLDER pending counsel**. The moment real testers hit a live camera, that copy is
   the operative BIPA §15(b) / WA MHMDA disclosure and the legal receipt's basis. A licensed
   Illinois biometric-privacy attorney MUST review the exact consent wording **and** the
   Biometric Data Policy before this build reaches a single friend's phone. This is the
   difference between "template" and "collecting biometrics from real Illinois residents."
2. **Distributing biometric collection to third parties, even known ones.** Handing a
   camera-on biometric app to a cofounder + friends is real-world BIPA collection from real
   people (some possibly Illinois residents). Counsel should confirm the consent flow +
   retention + deletion are sufficient for **non-you** subjects before distribution, and
   whether any tester-facing acknowledgment beyond the in-app consent is warranted.

Anything beyond this scope — public App Store release, moving the read off-device to a cloud
skin API, adding DNA/genetic features (GIPA), or expanding outside the US (GDPR) — is a
separate escalation and is explicitly **out of scope** for this contract.

---

## 9. Ruling — `EXPO_PUBLIC_CAMERA_DEMO` (OWN-DEVICE prototyping mode)

**Verdict: PASS, with conditions. Strictly scoped to the developer testing their OWN face
on their OWN device.** (Dwight, 2026-09-02, conv-cam-demo.)

Proposed mode: offline stub identity (no live Supabase → dodges the ATS/TLS blocker), but the
user is driven through the **real `/age-gate` + `/consent` screens with actual affirmative
taps**; the consent record is persisted to **local stub state** instead of the server
`consent_log`. `/scan` (camera) is reachable **only after** the real gate taps. Image still
deleted on-device via `withImageCleanup`. Build on `preview`.

- **(1) Local consent persistence acceptable for own-device testing? YES.** The immutable
  server `consent_log` (`0003`) is a durable, tamper-proof **receipt** whose legal value is
  proving consent was obtained *against an adverse third-party subject who might later
  dispute it*. When the only data subject is the developer capturing **their own** face on
  **their own** device, there is no adverse party to prove consent against — the receipt's
  evidentiary purpose is moot. Consent is still genuinely obtained (real disclosure + real
  affirmative tap); only the storage layer is local. Acceptable **for this scope only.**
- **(2) This is NOT the "DEMO stubs consent" hard-blocker. Confirmed.** That blocker fired
  because `EXPO_PUBLIC_DEMO` *fabricates* a consented identity and pre-resolves `route='home'`,
  so a live camera would capture biometrics with **no consent ever given**. `CAMERA_DEMO` is
  the opposite: consent is **real** (the user reads the copy and affirmatively taps through
  the actual gates); only the persistence is local. Materially different — that's why it passes.
- **(3) Conditions (all MUST hold):**
  - The **consent copy is displayed** on the real consent screen before the tap (placeholder
    copy is fine for own-device prototyping — the tap must be against real disclosure, not a
    bare button).
  - `nextRoute` must evaluate against the **locally-captured `is18` / `consent`, which only
    flip true after the real affirmative taps** — never hardcoded, never pre-resolved to
    `'home'`. If the gate can be reached without a real tap, this ruling is void.
  - Image **deleted on-device** (`withImageCleanup`); **zero biometric egress** — offline
    stub means nothing crosses the boundary, and **`check:no-egress` still applies** to the
    shared `capture/`/`read/`/`(dev)` code and MUST stay green.
  - Build on **`preview`** (not `development` — §4.4) and **US region**.
  - **The `EXPO_PUBLIC_CAMERA_DEMO` flag MUST be OFF in any build handed to another person.**
    If it reaches a friend's device it becomes real biometric collection from a third party
    with **no durable consent receipt** = BIPA exposure. Own-device only.
- **(4) FRIENDS-distribution is unchanged and NOT unlocked by this mode.** Shipping the live
  camera to cofounder/friends still requires the **full §0–§8 contract**: server
  `consent_log` (immutable receipt), **lawyer-signed** consent copy + Biometric Data Policy
  (🚩 §8), backend up with ATS/TLS resolved + a current `biometric` policy row, in-app
  revocation, and **ASC Age Assurance = YES / 18+**. `CAMERA_DEMO` is a prototyping stepping
  stone on the developer's own device, not a distribution path.

---

## 10. STANDING RULE — camera builds are direct-to-owned-device ONLY, never ASC/TestFlight

**Any build with `EXPO_PUBLIC_CAMERA_DEMO=1` (or any other live-camera capture path) MUST be
built and installed directly to a device the developer owns, and MUST NOT be uploaded to App
Store Connect / TestFlight — not even internal.** This is a hard operational invariant, not a
preference.

- **Why:** internal TestFlight **auto-distributes every uploaded build to every internal
  tester** — there is no per-build gate for internal groups. The EAS profile carrying no
  `submit` block only prevents an ASC *submit* action; it does **not** stop that internal
  auto-distribute once a build is uploaded. So the only reliable boundary is: **camera builds
  never reach ASC at all.**
- **Two-track separation (permanent):**
  - **Internal testers = the developer/owner ONLY.** No cofounder, no friend on the internal
    group while any camera build could be uploaded.
  - **Cofounder + friends = an EXTERNAL group** (per-build gated + Beta App Review), and the
    **only** build ever assigned to that external group is the **no-camera `testflight-demo`**
    build.
  - The **live-camera** build reaches the owner's device by **direct install**
    (`eas build -p ios --profile camera-demo` → direct/local install), never through ASC.
- Friends' **live** camera remains gated behind the full §0–§8 contract (server `consent_log`,
  lawyer-signed copy, backend + ATS, revocation, ASC Age Assurance = YES/18+). §10 does not
  unlock it.

## 11. Incident log

### 2026-09-03 — camera-demo build 4 auto-distributed to cofounder (internal TestFlight)

- **What happened:** The `camera-demo` build (build 4, `--profile camera-demo`, live face
  capture) was uploaded to TestFlight and **internal TestFlight auto-distributed it to the
  cofounder**, an internal tester. This crossed the own-device-only boundary of this contract.
- **Scan status:** **CONFIRMED — the cofounder DID run a face scan** (not install-only; user
  confirmed 2026-09-03). This is the worst-case branch of the ruling below, and it remains **de
  minimis**: the scan was an ephemeral, self-deleting on-device capture on a knowing associate's
  own device — the company **obtained and retained nothing** (offline stub identity, no backend /
  Supabase / `consent_log` write, image deleted on-device via `withImageCleanup`). No §15(b)
  collection *by the entity*, no §15(a) retention, and no notice / disclosure / purge owed.
- **Residual check (CLOSED):** confirmed 2026-09-03 — the cofounder is the **only** non-owner
  internal tester, so **no other person received build 4.** Incident **fully contained**
  (cofounder to be removed from the internal group + delete the app). No further exposure surface.
- **Residual exposure (ruling, Dwight):** **De minimis near-miss, no data in company control.**
  CAMERA_DEMO uses an offline stub identity and writes **nothing** to the backend / Supabase /
  `consent_log`; any captured frame is processed on-device and deleted immediately
  (`withImageCleanup`). Install-only = zero BIPA §15(b) exposure (nothing captured). Worst case
  (a scan ran) = an ephemeral, self-deleting on-device capture on a knowing associate's own
  device, with **nothing obtained, retained, or transmitted** by the company → no possession,
  no §15(a) retention record, nothing to disgorge. Not a reportable collection.
- **Containment:** (a) **do NOT run a scan — first and most important** (prevents even the
  ephemeral capture); (b) remove the cofounder from the internal group; (c) delete the app;
  (d) confirm whether a scan actually ran (get on record); (e) confirm no other non-owner
  internal testers received build 4. **No backend / `consent_log` purge is needed or possible —
  nothing was written, by design.**
- **Config fix (now a standing rule, §10):** camera builds are direct-to-owned-device only,
  never uploaded to ASC/TestFlight; internal testers = developer only; cofounder + friends on an
  external group receiving only the no-camera `testflight-demo` build.
- **Notice/remediation:** **No regulator notice, no user disclosure, no purge** — BIPA/MHMDA
  notice attaches to collected/retained data and none exists. This internal note is the audit
  record. Mention once to counsel at the next review for the record (a camera build momentarily
  reached a non-owner device, deleted on-device, zero retention) — documentation, not a filing.

---

## 12. STANDING POLICY — the two company principals may dogfood the on-device camera build

**Ruling: CONDITIONAL YES.** The owner **and** the single cofounder — both **company
principals, not members of the public** — may be **standing users** of the
`EXPO_PUBLIC_CAMERA_DEMO` on-device build on their own devices, as an ongoing internal
**dogfooding** arrangement (not "distribution to testers"). This is distinct from the one-time
§11 incident and is a deliberate, blessed posture.

**Why it holds for ongoing (not just one-off) use:** the "no data in company control" basis is
**architectural**, so it holds every run — CAMERA_DEMO uses an offline stub identity and writes
**nothing** to the backend / Supabase / `consent_log`, and every captured frame is deleted
on-device (`withImageCleanup`). Each principal still passes the **real** in-app age-gate +
consent flow (the gate requires real taps — see §9/§4), so informed consent is genuinely given;
only the durable written-release *receipt* is local, and its evidentiary value is moot for a
non-adverse co-principal consenting to their own capture on their own device.

**Standing conditions (all MUST hold — any breach drops to Tier-2 §0–§8):**
1. **Two named principals ONLY.** The camera build is used solely by the owner + the one
   cofounder. **Never a third person** — no other friend, tester, or member of the public, ever.
2. **Direct-install only (per §10) — NOT internal TestFlight.** Each principal receives the
   camera build by **direct install to their own device**. The camera build **MUST NOT** sit on
   an internal TestFlight group (even one frozen at two people), any external group, or a public
   link. *Rationale:* internal TestFlight auto-distributes every uploaded build to every internal
   tester — the exact mechanism that caused the §11 incident. Direct-install has **no
   auto-distribute surface** and cannot structurally reach a third person; a "frozen 2-person
   internal group" would rest safety on a human never adding a third tester, which is rejected.
   **Now enforced in config:** the `camera-demo` EAS profile is `distribution: "internal"`
   (ad-hoc / direct-install, no `submit` block) as of makeup-preview `@d8b625c` — so the profile
   is structurally incapable of reaching App Store Connect / TestFlight. Residual discipline: the
   ad-hoc install is scoped to device UDIDs registered via `eas device:create`, so **do not
   register a third device or share the install QR/link beyond the two principals.**
3. **Real in-app consent each principal.** The age-gate + consent screens run for real (no
   stub-through); image deleted on-device; nothing written server-side.
4. **Anyone beyond these two = full Tier-2 §0–§8 contract.** This clause does **not** touch the
   friends / external / public path, which stays fully gated (server `consent_log`,
   lawyer-signed copy, backend + ATS, revocation, ASC Age Assurance = YES/18+).

**Documentation on record (condition):** a short **written attestation from each _non-owner_
principal** who uses the camera build — i.e. **the cofounder's signature is REQUIRED** (the
second-person exposure that drove §12). The **developer / account-owner's own attestation is
OPTIONAL** (recommended for a tidy symmetric record, but not required — the account owner who
built the app and authored the consent flow is the entity itself dogfooding its own build on its
own device, so a receipt adds nothing legally there). Each attests that they are a company
principal, knowingly participating in on-device testing of **their own** biometric data,
understand the image is processed on-device and deleted with **nothing retained by the company**,
and consent — to be filed with this contract. This converts the arrangement
from "de minimis near-miss" into a documented knowing-principal dogfooding record. Route to the
human to sign + file; the build need not be blocked in the interim (retention is nil), but put it
on file promptly. **Attestation template:** `docs/ops/cofounder-camera-attestation.md`
(compliance-approved wording). **Status: pending the cofounder's signature** — file the signed
copy in the Company's records; this line closes when signed.
