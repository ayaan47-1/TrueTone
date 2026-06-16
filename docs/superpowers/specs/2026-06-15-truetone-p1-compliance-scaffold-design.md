# TrueTone — P1 Compliance Scaffold — Design Spec

> **Date:** 2026-06-15
> **Status:** Approved design, pending compliance-audit + user review before implementation.
> **Scope:** Sub-project 1 of TrueTone v0 — the P1 compliance scaffold (build-order steps 1–4).
> **Caveat:** Engineering/compliance guidance, **NOT legal advice.** A licensed Illinois
> privacy/biometric attorney reviews the consent flow and policies before launch. Policy copy in
> this scaffold is placeholder text pending counsel review.

---

## 1. Purpose & scope

Build an Expo app + Supabase backend that:
- gates users to **18+** (neutral DOB, derived flag only — DOB never stored),
- captures and logs **BIPA-grade biometric consent** before any future scan,
- exposes **data-rights** (view / delete-everything / account deletion),
- serves **versioned legal policies** reachable before any scan,
- enforces **US-only** distribution and **no ad/analytics SDK** on the data path.

**No camera, no ML, no scores in P1.** The schema, RLS, RPCs, and routing guards are built so the
camera (P2 read) and recommender (P3) slot in behind them without retrofit. This de-risks the
existential BIPA/COPPA exposure first, per CLAUDE.md §5 build order.

### Out of P1 scope (deferred, not forgotten)
- The FDA/FTC **language** layer — cosmetic-only vocabulary, disease blocklist, mole/cancer
  hard-refusal, analysis-model system prompt + post-filter, no-efficacy claims — applies to the
  **read (P2)** and **recommend/chat (P3)**. Nothing in this scaffold blocks them.
- On-device capture + ML, recommender/chat backend, progress/re-scan loop — later sub-projects.

### Non-code items (tracked, cannot be closed by code)
- Apple Developer **Organization** account (LLC + D-U-N-S). P1 targets Expo Go so this does not
  block P1, but it gates all P2 device/TestFlight testing and can take weeks — **start early.**
- Illinois privacy/biometric attorney review of consent flow + policies.
- Signed DPAs with any future face-data vendor (P2+).
- Breach-response plan (FTC HBNR timelines).

### Hard pre-P2 gates (must close before the camera captures any face data)
- **Verified backup/PITR purge (audit C2):** live-DB deletion is immediate (§5), but BIPA §15(e) /
  CLAUDE.md §1 require *verified* deletion of backups "on a defined cycle." P1 stores no biometric
  data, so this is low-risk now — but it is an **open control, not closed**, and MUST be proven
  (documented window + a verification mechanism) before P2 captures any face data. Tracked here so
  it is not silently rolled into prose.

---

## 2. Key decisions (resolved during brainstorming)

| # | Decision | Choice |
|---|---|---|
| Auth | identity model | **Anonymous-first** (Supabase anonymous auth → stable user id on first launch); upgrade to Apple/email later |
| Age gate | what is stored | **Derived `is_18_plus` flag + timestamp only; DOB never persisted** |
| Deletion vs consent | retention tension | **Delete personal/biometric data; retain minimized, de-identified consent receipt** |
| Privileged logic | where it runs | **Postgres `SECURITY DEFINER` RPCs + `pg_cron`, all inside Supabase** |
| Testing/dev | local stack | **Local Supabase (CLI/Docker) + migrations as source of truth; pgTAP + Jest/RNTL** |
| Policies | delivery | **Bundled in-app as versioned content** (public web versions deferred to store-listing step) |
| Build approach | decomposition | **DB-core-first, then UI vertical slices (Approach A)** |
| WA MHMDA | serve WA? | **Serve WA; add standalone WA consumer-health-data policy** |

---

## 3. Architecture

```
EXPO APP (iOS-primary, Expo Go for P1)
  Expo Router + NativeWind + TypeScript
  ├─ anonymous-auth bootstrap (Supabase) → stable user id on first launch
  ├─ routing guard: region(US) → is_18_plus → consent_active gates the future camera route
  └─ screens: Onboarding · Age Gate · Consent · Policies · Your Data/Delete
                    │  Supabase JS client (TLS), session-scoped
                    ▼
SUPABASE (US region; local CLI/Docker for dev)
  Postgres + Auth (anonymous) + RLS + pg_cron
  ├─ tables: profiles, consent_log (append-only), policy_versions, retention_runs
  ├─ RPCs (SECURITY DEFINER): record_consent, withdraw_consent, delete_my_data, delete_account
  └─ pg_cron: nightly retention sweep (3-yr inactivity / purpose-met)
```

**Compliance boundary:** only derived, non-image data ever exists in P1; it lives under per-user
RLS. The boundary holds trivially (nothing captured) but is established now.

### Repo layout (repo currently empty)
```
/app            Expo Router routes (screens)
/src
  /features     age-gate, consent, data-rights, policies (feature-grouped)
  /lib          supabase client, auth bootstrap, routing guard
  /content      versioned policy docs (Markdown) + version manifest
/supabase
  /migrations   versioned SQL (schema, RLS, RPCs, cron) — source of truth
  /tests        pgTAP tests
/test           Jest + RNTL setup
```

---

## 4. Data model

All timestamps UTC. RLS on every table; default deny.

### `profiles` — one row per auth user
| column | type | notes |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `is_18_plus` | boolean | derived flag only — DOB never stored |
| `age_verified_at` | timestamptz | when the gate passed |
| `consent_active` | boolean | fast-read mirror of current consent state for routing |
| `last_interaction_at` | timestamptz | drives the 3-yr retention sweep; bumped on app open / key actions |
| `created_at` | timestamptz | |

RLS: user may `select`/`update` only `where id = auth.uid()`. No client `delete` (RPCs only).

### `consent_log` — append-only legal record
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `consent_id` | uuid | stable, non-identifying handle that survives deletion |
| `user_id` | uuid FK→profiles, **nullable** | set NULL on deletion → de-identified receipt |
| `action` | enum | `consented` \| `withdrawn` \| `deleted` |
| `policy_version` | text FK→policy_versions | pins exactly what was agreed |
| `created_at` | timestamptz | the legal timestamp |

RLS: user may `insert`/`select` only own rows (`user_id = auth.uid()`); **no** `update`/`delete`
for anyone (append-only enforced by RLS + trigger blocking update/delete). On account deletion the
RPC nulls `user_id`, leaving a de-identified receipt (`consent_id`, `action`, `policy_version`,
`created_at`).

### `policy_versions` — registry of bundled legal docs
| column | type | notes |
|---|---|---|
| `version` | text PK | e.g. `2026-06-15.1` |
| `doc_key` | text (enum/CHECK) | `privacy` \| `terms` \| `biometric` \| `retention` \| `wa_health` — constrained by CHECK/enum so the registry can't drift (audit N2) |
| `effective_at` | timestamptz | |
| `is_current` | boolean | |

RLS: world-readable (`select` for `anon` + `authenticated`); no client writes.

### `retention_runs` — audit of the scheduled sweep
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `ran_at` | timestamptz | |
| `purged_count` | int | proves the schedule executes |

### Invariants (→ pgTAP tests)
- No table stores DOB or any image/biometric data.
- `consent_log` rows can never be mutated or hard-deleted (only `user_id`→NULL via RPC).
- Every `consent_log.policy_version` exists in `policy_versions`.
- A user can never read/modify another user's `profiles` or `consent_log` rows.

**Seeding note (audit N5):** the `/src/content` version manifest and the `policy_versions` rows are
seeded from a **single source** (one manifest → DB seed migration) so the §8 "version mismatch →
block consent" path never fires spuriously on day one.

---

## 5. Compliance core (RPCs + retention)

All RPCs `SECURITY DEFINER`, owned by a privileged role, `search_path` locked, single-transaction,
acting only on `auth.uid()` (caller cannot pass another user's id).

- **`record_consent()`** — reads current `policy_version` server-side; inserts `consent_log`
  (`action='consented'`, new `consent_id`, `user_id=auth.uid()`); sets `consent_active=true`, bumps
  `last_interaction_at`; idempotent (no duplicate active consents); returns the record.
- **`withdraw_consent()`** — inserts `consent_log` (`action='withdrawn'`); sets
  `consent_active=false`; does **not** delete data (withdrawal ≠ deletion).
- **`delete_my_data()`** — purges the user's derived data (P1: resets `profiles` to a minimal stub,
  clears `is_18_plus`/`age_verified_at`; P2+: also deletes scores); inserts `consent_log`
  (`action='deleted'`); nulls `user_id` on prior consent rows → de-identified receipts; keeps the
  auth account alive (user may re-consent).
- **`delete_account()`** — everything `delete_my_data` does, plus deletes the `profiles` row and the
  `auth.users` record (admin path); leaves only de-identified receipts; session ends → app resets
  to fresh-install.
- **Retention sweep (`pg_cron`, nightly)** — selects `profiles` with
  `last_interaction_at < now() - interval '3 years'`; runs the `delete_account` purge path per user;
  records a `retention_runs` row.
  - **Purpose-met trigger (audit M3, deferred to P2):** BIPA §15(a) requires destruction at
    "purpose met OR 3 years of last interaction, whichever is **first**." P1 implements only the
    3-year-inactivity arm; the "purpose-met" arm has no purpose to model yet (no biometric data).
    It is **deferred to P2, not dropped** — recorded here so the second trigger is added when the
    scan exists.

**Backups (audit C2):** live-DB deletion is immediate; Supabase PITR/backup copies age out within
the documented retention window. The window is a documented policy/config item, **and verified
backup purge is a hard pre-P2 gate** (see §1 "Hard pre-P2 gates") — not asserted as complete in P1.

---

## 6. App shell, routing & gating

**Bootstrap (on launch):** init Supabase client → ensure anonymous session (create if missing) →
fetch/create `profiles` row → bump `last_interaction_at`.

**Routing guard (Expo Router layout-level), strict order:**
```
Region check (US?) ──no──▶ "Not available in your region"
        │ yes
is_18_plus? ──no──▶ Age Gate
        │ yes
consent_active? ──no──▶ Consent
        │ yes
Main app (P1: Home + Your Data; P2: camera route slots in HERE — behind all three checks)
```
- Single chokepoint; the future camera route is impossible to reach without region + 18+ + consent.
- **Geo guard:** App Store availability = US-only is primary; runtime check (device region / store
  front, coarse only — no precise location) is secondary, failing closed to the not-available
  screen.
- Gate state source of truth = `profiles` (RLS-protected); cached in memory for fast routing, never
  trusted from client for writes.

---

## 7. Screens

1. **Onboarding / Home** — surfaces the not-a-medical-device **standing disclaimer** (spec §2.3);
   launchpad to the future scan (locked until P2).
2. **Age Gate** — neutral DOB entry (date fields/picker, not an "I am 18+" checkbox). On submit:
   compute age in-memory → if ≥18 set `is_18_plus`/`age_verified_at`, **discard DOB**; if <18 →
   blocking screen, nothing stored.
3. **Consent** — renders versioned biometric-consent copy. Invariants:
   - **§15(b) content (audit C1, tested):** the screen MUST display the three BIPA §15(b) mandatory
     disclosures — **(a) what** biometric data is collected, **(b) the specific purpose**, **(c) the
     retention period** — either inline or via a clearly-linked Biometric Data Policy that contains
     them. This is a **tested invariant** (RNTL asserts the disclosures/links render), not just
     placeholder prose, so the substantive §15(b) content can't be silently dropped during copy edits.
   - **One screen, two standards (audit C3):** the consent copy is drafted to satisfy **both** BIPA
     §15(b) **and** WA MHMDA consumer-health-data *consent* (not only the WA policy doc), per the
     dev-spec §3.3 strictest-common-denominator strategy.
   - **No pre-checked box**; **"I Consent" disabled until box actively checked**; standalone
     (biometric consent only, not bundled with Terms/marketing); links to Biometric Data Policy;
     on consent → `record_consent()`; "Decline" leaves camera locked.
4. **Policies** — list + reader for five bundled docs: Privacy Policy, Terms, Biometric Data Policy,
   Retention Schedule, WA Consumer-Health-Data Policy. Versioned Markdown in `/src/content`;
   reachable before any scan. All marked placeholder pending counsel.
5. **Your Data** — shows held data (P1: 18+ status, account created date, consent history with
   dates + policy versions); actions: **Withdraw Consent** → confirm → `withdraw_consent()` (audit
   M5 — RPC already exists; withdrawal ≠ deletion, leaves data, re-locks camera); **Delete My Data**
   → confirm → `delete_my_data()`; **Delete Account** → stronger confirm → `delete_account()` →
   session ends, reset to fresh-install.

---

## 8. Error handling

Fail-closed on anything compliance-relevant.
- **Auth/bootstrap failure:** retry screen, stays locked; never proceeds on unknown identity.
- **Geo check inconclusive:** fail closed → not-available + retry.
- **RPC failures:** user-friendly error + retry; atomic transactions leave no half-written state
  (consent not recorded ⇒ `consent_active` stays false ⇒ camera locked). Deletion failures
  explicitly state it did NOT complete.
- **Policy version mismatch** (bundled version ≠ `is_current`): block consent + log; never record
  consent against an undisplayable version.
- **Input validation (DOB):** reject impossible/empty dates at the boundary; no coercion.
- **No sensitive data in errors/logs:** exclude DOB and personal data.

---

## 9. Testing strategy (TDD throughout, 80%+ coverage)

- **DB core (pgTAP, local Supabase), RED first:** §4 invariants + §5 RPC behavior — per-user
  isolation, `consent_log` immutability, de-identified receipt survives deletion
  (`user_id IS NULL`), `record_consent` pins correct version + idempotent, withdrawal ≠ deletion,
  retention sweep selects exactly >3yr-inactive users and de-identifies their consent.
- **App unit/component (Jest + RNTL):** age-gate age math + never persists DOB **and DOB never
  reaches the network/log layer** (audit N3 — the subtle telemetry-leak path); consent button
  disabled until box checked; **consent screen renders the §15(b) what/purpose/retention disclosures
  or their policy link** (audit C1); routing guard order (region→18+→consent) + locks gated route;
  Your Data actions (withdraw / delete data / delete account) call correct RPCs behind confirmation;
  disclaimer present on onboarding (and contains no efficacy/equity claim).
- **Compliance guardrail (CI):** build **fails** if a forbidden ad/analytics SDK appears in
  `package.json`, **the lockfile (transitive deps), or Expo plugin config (`app.json` /
  `app.config.js`)** (audit M1) — Firebase Analytics, Meta/Facebook SDK, ad networks, etc.
- **Integration:** bootstrap → age gate → consent → gated route unlocks, against local Supabase.
- **E2E:** deferred (Expo Go + Maestro candidate noted, not built in P1).
- Compliance invariants are must-pass regardless of coverage %.

---

## 10. Build sequence & subagent decomposition (Approach A)

TDD throughout. **Each subagent's task is described and approved before invocation** (user rule).

- **Phase 0 — Foundation (direct, no subagent):** scaffold Expo (SDK 56, Router, NativeWind, TS);
  `supabase init` + local stack; Jest/RNTL + pgTAP harness; CI skeleton.
- **Phase 1 — DB compliance core (1 subagent, sequential):** pgTAP RED-first for §4 schema + §5
  RPCs + retention, then migrations to GREEN (`profiles`, `consent_log` + append-only trigger,
  `policy_versions`, `retention_runs`, RLS, four RPCs, `pg_cron`). Runs alone first — all UI
  depends on it.
- **Phase 2 — App shell + routing guard (1 subagent):** Supabase client/auth bootstrap, the
  region→18+→consent guard, fail-closed behavior.
- **Phase 3 — Screen slices (3 parallel subagents, git-worktree isolated):**
  - 3a Age Gate (derived flag, no DOB persisted)
  - 3b Consent (no pre-checked box, disabled-until-checked, `record_consent`)
  - 3c Your Data + Policies + onboarding disclaimer (withdraw + delete RPCs, 5 bundled policies
    incl. WA, standing disclaimer)
  - Dispatched in one batch; each in its own worktree to avoid collision; merged after.
- **Phase 4 — CI guardrail + integration (1 subagent):** no-analytics-SDK build check +
  bootstrap→gate→unlock integration test.
- **Cross-cutting:** code-review/compliance pass after each phase before merge.

---

## 11. Compliance coverage summary

Covered by this scaffold: BIPA §15(b) consent before collection + logging (user id/timestamp/
version, §15(b) disclosures tested), §15(a) retention + automated deletion (3-yr arm; purpose-met
arm deferred to P2), §15(e) security (TLS + Supabase at-rest encryption + RLS — verify explicitly),
18+ gate without DOB storage, in-app withdraw/delete/account-deletion, US-only geo-restriction, no
ad/analytics SDK (CI-enforced incl. lockfile + Expo config), WA MHMDA standalone policy + consent
element, not-a-medical-device standing disclaimer, standalone affirmative consent.

**Structurally satisfied (vacuously, no biometric data exists yet) (audit N1):** BIPA §15(c)/(d)
no-sale/no-sharing — no biometric data to sell or share and no SDK on the data path. Becomes an
active control in P2.

**Flagged for counsel / P2 review (not code blockers):** App Review acceptance of anonymous-auth
teardown as "account deletion" (audit M2); geo fail-closed cannot be VPN/region-spoofed into the
camera route (audit M4, a P2 concern).

**Open pre-P2 gate:** verified backup/PITR purge (audit C2, §1).

Not asserted as legally sufficient — the attorney review gate (§1 non-code items) remains required.
