# TrueTone — Brand-Neutral Routine + Scoped Chat (Design Spec)

**Date:** 2026-06-18
**Build-order step:** 6 (routine + "why this product" chat, scores-only)
**Status:** Design approved; not yet planned or built.
**Sub-project relationship:** This is the routine+chat sub-project. A **makeup shade-matching**
sub-project is planned as a sibling next; this design leaves a `RecommendationDomain` seam so makeup
plugs in later without a refactor. Makeup itself is explicitly **out of scope here**.

---

## 0. Summary

After an on-device read produces derived cosmetic scores + skin-type feel (P2), TrueTone generates a
**brand-neutral skincare routine** (approved cosmetic **categories + habits**, zero brand names) and
offers a **scoped chat** that explains *this user's* read and routine. The routine is produced by a
**pure, deterministic, on-device engine** — no LLM touches it. An LLM (Claude) powers **only** the
chat, inside a single Supabase Edge Function, with the §1 cosmetic post-filter on its output and a
hard dermatologist-referral refusal on any medical query.

The whole feature lives **after** the read, so **no image is ever involved**; only derived
scores/routine text exist on the backend side of the compliance boundary (CLAUDE.md §3).

---

## 1. Decisions (locked during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Routine content | **Brand-neutral categories + habits** (no brands) | Lowest compliance + affiliate/FTC surface; matches "brand-neutral" literally. |
| Routine generation | **Deterministic, pure engine** (Approach A) | Routine is structurally incapable of emitting a disease term/claim; auditable; cheap; stable to persist; confines LLM risk to chat. |
| Chat scope | **Scoped to the user's read + routine** | Smallest guardrail surface; most predictable; easiest to keep cosmetic-side. |
| Persistence | **Save routine (on the scan row); chat ephemeral** | Data-minimization; routine inherits existing retention/delete machinery; no chat transcript stored. |
| LLM | **Claude Sonnet 4.6** via Anthropic API, server-side only | Capable + cost-effective for a scoped explanation chat; latest Claude per project guidance. |
| Makeup | **Out of scope**, seam only | YAGNI: a module boundary (`RecommendationDomain`), not a plugin framework. |

---

## 2. Architecture & the compliance boundary

```
ON DEVICE
  scan result (scores + skinType, from P2)
      │
      ▼
  recommendation engine  ──pure, offline, deterministic──►  Routine (AM/PM steps)
      │                                                          │
      │ persist via record_scan (scores + routine, atomic)       │ display (offline)
      ▼                                                          ▼
─────────────── compliance boundary: only derived data crosses (CLAUDE.md §3) ───────────────
BACKEND (Supabase, US region)
  scans row: scores + routine (RLS, retention, delete-everything — all existing)
  Edge Function `routine-chat`  ──► Anthropic API (Claude) ──► cosmetic post-filter ──► reply
       (loads scores+routine under caller RLS; chat is ephemeral, nothing stored)
```

- The **routine** is pure / deterministic / on-device: instant, offline, auditable.
- The **LLM lives only inside `routine-chat`**, with the post-filter on its output.
- **No image** is ever present in this feature — it is structurally impossible to leak one.

### 2.1 Module map (new)

| Module | Purpose | Depends on |
|---|---|---|
| `src/features/recommend/domain.ts` | `RecommendationDomain` seam: `{ id; buildRoutine(attrs) }`. Skincare is the only impl now. | `routine-types` |
| `src/features/recommend/skincare/library.ts` | Authored, counsel-reviewable catalog of approved **categories + habits** (brand-neutral strings only). | `cosmetic-vocab` |
| `src/features/recommend/skincare/rules.ts` | Pure mapping `(scores, skinType) → applicable categories/habits`. | `library`, `cosmetic-vocab` |
| `src/features/recommend/routine-engine.ts` | Pure `(domain, attrs) → Routine`; assembles ordered AM/PM steps. | `domain`, `skincare/*` |
| `src/features/recommend/routine-types.ts` | `Routine`, `RoutineStep` types. | — |
| `supabase/functions/routine-chat/` | Sole network/LLM piece (Deno/TS). | `cosmetic-filter`, `cosmetic-vocab` (shared logic) |
| `app/.../routine` + chat screens | Routine view + ephemeral chat UI (Expo Router + NativeWind). | engine output, `routine-chat` |

**Reuses (no duplication):** `src/lib/cosmetic-filter.ts` (post-filter, tested) and
`src/content/cosmetic-vocab.ts` (`DIMENSIONS`, `SKIN_TYPE_FEELS`, `DISEASE_BLOCKLIST`,
`APPROVED_LABELS`, `BAND_LABELS`, `SCORE_COLUMNS`).

### 2.2 Makeup-readiness (seam only)

`RecommendationDomain` is a thin interface — `id` + `buildRoutine(attrs)`. Skincare implements it now
(`attrs = { scores, skinType }`). A future makeup domain (`attrs = { undertone, depth, ... }`)
implements the same interface and renders through the same routine-view shell. This is the **only**
makeup concession in this sub-project; no makeup data model, content, or UI is built here.

---

## 3. Data model & persistence

The routine is **1:1 with a scan** (a scan's scores are immutable → its routine is stable), so it is
stored as a **column on `scans`**, inheriting all existing compliance machinery for free.

### 3.1 Schema change (one migration extending `scans`)

- `routine jsonb not null` — the generated routine.
- `routine_engine_version text not null` — provenance (e.g. `"skincare-1"`) for audit / future
  regeneration reasoning.

### 3.2 Write path

Extend the existing `record_scan` RPC to accept `routine` + `routine_engine_version` and write them
in the **same atomic insert** as the scores (one row, one round-trip). The device computes the routine
on-device right after the read and passes it alongside the scores. The RPC **validates the routine's
shape** at the boundary (per "validate at boundaries") before insert — reject malformed routines.

### 3.3 Why column-on-scans is the compliance win

Because `routine` lives on the `scans` row, it is automatically covered by the existing:
- owner-only **RLS**,
- BIPA **§15(a) purpose-met** trigger,
- **3-year retention** cron,
- **delete-everything** + full account deletion,
- **backup/PITR purge** cycle.

**Zero new retention/deletion code.** Aligned with data-minimization.

### 3.4 Stored routine shape

```json
{
  "version": "skincare-1",
  "am": [{ "category": "...", "habit": "...", "rationaleKey": "...", "dimensions": ["hydration"] }],
  "pm": [{ "category": "...", "habit": "...", "rationaleKey": "...", "dimensions": ["dark_spots"] }],
  "notes": ["..."]
}
```
Every string is drawn only from the approved library — never free text.

### 3.5 Chat persistence

**None.** `routine-chat` reads scores + routine from the caller's own scan row (under RLS) and stores
nothing — no chat table, no transcript. Multi-turn context within a session is client-held and passed
per call.

### 3.6 Trade-off recorded

Column-on-scans (1:1) chosen over a separate `routines` table (1:many history). The 1:1 relationship
is real, and the column inherits retention/delete machinery. If routine history decoupled from scans
is later needed, that is a clean migration when the need is concrete.

---

## 4. The chat Edge Function & guardrails (compliance-critical)

`supabase/functions/routine-chat/` (Deno/TS, US region). Request `{ scanId, message, history }`;
`history` is client-held session context passed per call. **Nothing is persisted.**

### 4.1 Request flow (defense-in-depth layers)

1. **Auth** — verify the Supabase JWT; reject anonymous calls.
2. **Load context under RLS** — fetch the scan row *as the caller* (RLS enforces ownership); pull
   scores + skinType + routine. Not found/owned → 404. **(Layer 1: scores-only context — no image
   exists here.)**
3. **Input refusal guard** — match `message` against the mole / lesion / cancer / melanoma triggers.
   On hit → **short-circuit to the canned dermatologist-referral message without calling the LLM**
   (CLAUDE.md §1: hard-refuse regardless of phrasing). **(Layer 2.)**
4. **Build prompt** — system prompt constrains Claude to: describe *appearance only* in approved
   cosmetic descriptors; answer *only* about this user's read + routine; recommend only OTC
   care/habits; never diagnose / treat / cure; redirect to a dermatologist for anything medical.
   Context = the user's scores as **band labels** (not raw numbers) + skinType + routine + the
   session `history` + the new `message`. **(Layer 3: system prompt + output schema.)**
5. **Call Claude (Sonnet 4.6)** — Anthropic key from Supabase secrets, **server-side only**, never in
   the app bundle. Bounded `max_tokens`, timeout, single retry max. Per-user **rate limit**.
6. **Output post-filter** — run the reply through `src/lib/cosmetic-filter.ts` (shared logic). On any
   blocklisted disease term or diagnostic phrasing → **fail-closed**: discard the LLM text, return a
   safe fallback, log the incident server-side (no PII). **(Layer 4: fail-closed catch.)**
7. **Return** the filtered message. Store nothing.

### 4.2 Error handling

- Anthropic API error/timeout → graceful "couldn't load right now"; never expose the raw error.
- Empty/abusive input → validated and politely rejected.
- Rate-limit exceeded → polite throttle message.

### 4.3 Flagged launch-blocker (CLAUDE.md §6 — NOT resolved in code)

This feature sends **derived cosmetic scores** (health-adjacent) to a third-party LLM vendor
(Anthropic). CLAUDE.md §2 blesses the *architecture* ("a cloud LLM called from OUR backend, fed only
derived scores"), so the category is pre-approved — but §1 (no third-party sharing of health data
without separate consent) + §6 (any API that can access skin/score data → flag to founders) require:

- [ ] **Founder/counsel sign-off on the specific LLM vendor (Anthropic).**
- [ ] **Privacy Policy / Biometric Data Policy updated to enumerate the LLM provider as a
      subprocessor** and describe exactly what derived data is sent (scores + routine; never the
      image).
- [ ] **Consent copy covers** that derived (non-image) scores are sent to an LLM provider for the
      routine-chat feature.

No image ever leaves the device; only derived scores. This item is carried as an explicit
**launch-blocker**, not resolved by this implementation.

---

## 5. Client UX

Expo Router + NativeWind, hanging off an existing scan result.

### 5.1 Routine view (no network)

- Rendered from the stored `routine` JSON. AM / PM sections; each step = **category + habit + short
  rationale** ("for the appearance of dark spots"). Brand-neutral throughout.
- Persistent plain-language disclaimer: cosmetic guidance about how skin *looks*, not medical advice.
- Reachable from a scan result and from scan history (persisted per scan).
- Works fully offline (derived data already on the row).

### 5.2 Chat (ephemeral, scoped)

- Opens from the routine view. Session-only message list in component state; **cleared on exit, never
  persisted**.
- Each turn calls `routine-chat` with `{ scanId, message, history }`.
- Explicit states: sending / reply / **dermatologist-referral** (visually distinct, "this isn't a
  diagnosis" framing) / graceful error / offline (chat disabled with a note that the routine still
  works).
- Input affordance ("Ask about your routine") sets scope expectations.

### 5.3 Makeup-readiness touch

The routine view reads `routine.version`/domain and renders whatever the domain produced. Skincare is
the only domain now (no UI branching), but a future makeup domain renders through the same shell.

---

## 6. Testing strategy

TDD; Jest (TS), SQL tests mirroring P2 scan tests, **LLM mocked — no real API in tests**.

### 6.1 Pure unit (bulk; RED→GREEN first)

- `routine-engine` + `skincare/rules` + `library`: every score/skin-type profile → expected
  categories; ordering; edge profiles (all-low, all-high, mixed).
- **Invariant test:** the engine can *only* emit strings present in the approved library — assert
  every output string ∈ library (structural proof it cannot make a claim).
- `domain` seam: skincare implements the interface; shape contract holds.
- `cosmetic-filter`: reuse existing tests; add chat-output cases.

### 6.2 Edge Function (`routine-chat`) — Anthropic client mocked

- Input refusal: mole/lesion/cancer/melanoma phrasings → referral message, **LLM never called**
  (assert zero mock calls).
- Output post-filter fail-closed: mock returns a disease term → caller gets the safe fallback, not raw
  text; incident logged.
- Prompt building: context carries band labels + routine; **never raw image; raw numbers not surfaced
  as medical**.
- Auth required; rate limit enforced; API error → graceful message.

### 6.3 SQL / data layer (mirrors P2 scan tests)

- `record_scan` extended: routine + version persist atomically; shape validation rejects malformed
  routine.
- RLS isolation: user A cannot read user B's routine.
- Delete-everything purges the routine (on the scan row); retention/purpose-met cron covers it — no
  orphaned routine survives.

### 6.4 Compliance guards (CI)

- `check:compliance` / `check:no-egress` still pass (no new analytics SDK; no image path).
- Assert the chat function payload schema contains **no image field** by construction.

### 6.5 Explicitly NOT tested

- Real Anthropic responses (mocked).
- On-device camera (out of scope — entirely post-read).

---

## 7. Definition of done (CLAUDE.md §7 mapped)

- [ ] No raw image persisted server-side / no image in this feature at all (structural).
- [ ] No new SDK/vendor with access to face/health data **except** the flagged LLM vendor (§4.3 —
      launch-blocker pending counsel).
- [ ] All chat output passes the cosmetic post-filter (fail-closed); routine is library-only by
      construction.
- [ ] Gated behind the existing 18+ gate + logged consent (chat is post-read, post-consent).
- [ ] Routine covered by delete-everything + retention/auto-deletion (inherited via scans row).
- [ ] Encrypted in transit + at rest; RLS scoped to the owning user.
- [ ] No user-facing accuracy/efficacy/equity claim shipped without backing data.
- [ ] §4.3 vendor-disclosure launch-blocker resolved with counsel before public launch.

---

## 8. Out of scope (this sub-project)

- Makeup shade matching (separate sibling sub-project; seam only here).
- Specific-product / branded recommendations and any affiliate mechanics.
- General (un-scoped) cosmetic Q&A — chat is scoped to the user's read + routine; expandable later.
- Chat transcript persistence / history.
- Progress re-scan + trend loop (build-order step 7).
