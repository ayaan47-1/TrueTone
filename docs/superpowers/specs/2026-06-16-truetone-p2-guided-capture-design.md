# TrueTone P2 — Guided Capture + On-Device Read (Design Spec)

> **Status:** Approved in brainstorming 2026-06-16. Engineering + compliance design, NOT legal
> advice — counsel reviews before any external/public capture. Read alongside `CLAUDE.md` (the build
> guardrails) and the P1 spec `docs/superpowers/specs/2026-06-15-truetone-p1-compliance-scaffold-design.md`.

## 1. Summary

P2 is sub-project 2 of TrueTone v0: the **camera + on-device read** phase. It builds the full
pipeline **capture → quality gate → on-device read → derived cosmetic scores → storage → results
UI**, end to end on a physical iPhone, with the compliance boundary (`CLAUDE.md` §3) intact: the raw
face image lives and dies on the device; only derived scores cross to the backend.

**Scaffold-first, exactly like P1.** P2 ships with a **deep stub model**: the real
`react-native-executorch` runtime running a *trivial placeholder model file*. This proves the
genuinely risky, least-reversible part — the native inference seam (New Architecture module,
image→tensor preprocessing, tensor readback) — without blocking on a trained model. When the real
model exists it is a **file swap**, not new plumbing.

**Out of scope for P2 (the next sub-project):** the real trained model, the balanced
Fitzpatrick I–VI test set, and any fairness / accuracy / skin-tone-equity validation or claim. P2's
UI makes **no** accuracy or equity claim anywhere (`CLAUDE.md` §1, FTC §5 / ICFA).

## 2. Locked decisions (from brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope | Pipeline scaffold with a stub model; real model + fairness = later sub-project |
| 2 | Stub depth | **Deep stub** — real executorch runtime, trivial placeholder model |
| 3 | Backup/PITR purge gate | **P2 Task 0** — built before any camera code; internal dev-device testing allowed; external/TestFlight + real model blocked until closed + counsel sign-off |
| 4 | Score representation | Numeric **0–1 per dimension stored**; UI shows **qualitative bands only** (no numbers) + direction arrow vs last scan |
| 5 | Quality gate | **Blocking** (shutter/auto-capture disabled until face + lighting + focus + distance all pass), with live guidance + a Cancel exit |
| 6 | Capture trigger | **Auto-capture** — fires after all checks hold green ~1.5s, short countdown |
| 7 | Results layout | **Dimension list** — grouped "Skin qualities" / "Appearance of", 3-segment bands + plain labels |

## 3. Cosmetic vocabulary (the only allowed output)

Per `CLAUDE.md` §1, the read may emit ONLY these descriptors. This set is the single source of truth
(`src/content/cosmetic-vocab.ts`) feeding the stub, the post-filter, and the UI.

**Skin qualities:** hydration look · oiliness · texture · pores
**Appearance of:** dark spots · redness · fine lines · dark circles
**Skin-type feel:** dry · oily · combination · sensitive-feeling

Each dimension stores a continuous `0–1` value and maps to a 3-band label (e.g. hydration →
*looks dehydrated / balanced / looks well-hydrated*). Band labels and all on-screen copy are
**placeholder pending IL counsel review** (same posture as P1 policy copy).

**Hard blocklist (rejected everywhere):** disease names and diagnostic phrasing — acne, rosacea,
eczema, melasma, dermatitis, psoriasis, skin cancer, melanoma, etc. Any mole / lesion / "cancer" /
"melanoma" intent returns the dermatologist-referral message and never a read (`CLAUDE.md` §1).

## 4. Architecture & data flow

```
ON DEVICE (new in P2)
  route entry (P1 guard: region → 18+ → logged consent)
    → guided capture (vision-camera v5, blocking quality gate, auto-capture)
    → preprocess (image → input tensor: resize/normalize)
    → on-device read (react-native-executorch, trivial STUB model)
    → ScoreVector (0–1 per dimension) + skin-type feel
    → DELETE raw image + tensor  ← in finally, even on failure
──────────── compliance boundary: only derived scores cross ────────────
BACKEND (Supabase US, new in P2)
  cosmetic post-filter (reject any off-vocabulary/disease term before persist)
    → scans table (append-only, RLS own-rows, numeric scores)
    → delete_my_data purges scans · §15(a) purpose-met trigger · backup-purge reconciliation (Task 0)
  UI reads scans back → renders qualitative bands (numbers never shown)
```

The boundary holds because the image is never uploaded, logged, or cached. The post-filter is
defense-in-depth: even though the structured stub can only emit approved dimensions, every label is
validated against the allowlist + blocklist before it is persisted or displayed.

## 5. Components & files

Following P1 conventions (`src/features/<feature>`, `src/lib`, `app/`, `supabase/migrations`+`tests`);
many small, focused, mostly-pure files so Jest can cover logic and the native seam is thin.

### Shared contract
- `src/content/cosmetic-vocab.ts` — approved dimension keys, per-dimension band thresholds + plain
  labels, skin-type-feel values, and the disease/diagnostic blocklist. Single source of truth.
- `src/features/read/read-types.ts` — `ScoreVector` (dimension→0–1), `SkinTypeFeel`, `ReadResult`,
  `QualityReport`.

### Capture — `src/features/capture/`
- `quality-gate.ts` — *pure*: frame metrics (face bbox, brightness, sharpness, distance) →
  `{ face, lighting, focus, distance, allPass, hint }`.
- `capture-controller.ts` — *pure reducer*: auto-capture state machine
  (idle → aligned-holding → countdown → captured), driven by gate status + ticks; resets on lost
  alignment; no double-fire.
- `Capture.tsx` — camera view (framing oval, status chips, hints, countdown, Cancel). Thin shell
  over the two pure modules.

### On-device read — `src/features/read/`
- `preprocess.ts` — *pure-ish*: image URI → normalized input tensor (the stub→real contract).
- `read-engine.ts` — `ReadEngine` interface: `run(imageUri): Promise<ReadResult>`.
- `executorch-engine.ts` — real `react-native-executorch` implementation loading the stub model.
- `assets/stub-model.*` — trivial placeholder model file (real runtime, fixed/derived outputs).
- `image-lifecycle.ts` — guarantees raw photo + tensor deletion in a `finally`, with retry +
  PII-free marker on delete failure.
- `bands.ts` — *pure*: 0–1 value → band label per dimension.

### Compliance filter & data access — `src/lib/`
- `cosmetic-filter.ts` — *pure*: validate labels/strings against allowlist + blocklist; reject
  off-vocabulary. Runs on-device before persist AND server-side before insert.
- `scans.ts` — client data access: `recordScan`, `fetchLatestScan`, `fetchScanHistory`.

### Backend — `supabase/migrations/` (continuing the `000N_` sequence)
- `0007_backup_purge.sql` — **Task 0**: `deletion_audit` table + `pg_cron` reconciliation job that
  verifies purged rows are gone past the documented PITR window; flags unreconciled rows; idempotent.
  Accompanied by a written PITR-window doc.
- `0008_scans.sql` — `scans` table: `id`, `user_id` FK → `profiles(id)`, `captured_at`, one
  `numeric(4,3)` (0–1) column **per dimension** (explicit columns, not `jsonb`, so pgTAP can assert
  types and the schema self-documents), `skin_type_feel`, quality flags, `model_version`, `is_stub`
  flag. Append-only; RLS own-rows select/insert; no update/delete.
- `0009_scan_rpcs_retention.sql` — `record_scan` RPC (validates vocabulary server-side before
  insert; SECURITY DEFINER, search_path locked, granted to `authenticated`); extend
  `delete_my_data()` to purge the caller's scans; extend `truetone_retention_sweep()` so scans are
  destroyed with the profile; add the deferred **BIPA §15(a) purpose-met** trigger.
- pgTAP tests alongside each in `supabase/tests/`.

### App routes — `app/`
- `app/scan/index.tsx` — capture route (behind the P1 routing guard).
- `app/scan/result.tsx` — results route (dimension list).
- Unlock the scan entry on the P1 home launchpad (was locked until P2).

### Native build config
- Add `expo-dev-client`, EAS build config, vision-camera + executorch config plugins, and the
  specific camera **permission purpose string** (vague strings fail Apple review, `CLAUDE.md` §4).
- New Architecture is already on (SDK 56 default).

## 6. Error handling — fail closed everywhere

Two invariants govern every path: **the image never leaks**, and **nothing off-vocabulary is ever
persisted or shown.**

- **Camera permission denied** — explanatory screen + deep-link to Settings; never proceed, never crash.
- **Quality gate never passes** — capture stays disabled (blocking, no override); a persistent
  **Cancel → home** exit prevents trapping the user (exit ≠ low-quality capture).
- **Read engine failure** (model load / inference / native) — caught; image deleted in `finally`;
  "couldn't complete the read — try again"; nothing persisted.
- **Image deletion failure** — critical: retry delete, surface no sensitive detail, emit PII-free
  log marker. The `finally` + retry are what make the on-device-only promise real.
- **Post-filter rejection** — hard fail closed: do not persist or display; treat as read failure;
  log which term tripped (PII-free). Last line defending the FDA cosmetic boundary.
- **Persist/network failure** — image is already gone; keep derived scores in memory, offer
  **Retry save** (no re-capture); on give-up, discard the read.
- **Backup-purge job failure** (Task 0) — `deletion_audit` flags rows not reconciled past the PITR
  window; job is idempotent and re-runs.

## 7. Testing strategy

Three layers, mirroring P1 (the native read runs only on a device, so real logic lives in pure
modules Jest can cover).

**Unit (Jest) — carries the 80% coverage gate**
- `quality-gate` — each metric pass/fail independently, `allPass` combination, correct hint per failure.
- `capture-controller` — aligned-hold → countdown → captured; reset on lost alignment; no double-fire.
- `preprocess` — tensor shape + normalization math at boundaries.
- `bands` — 0–1 → label at every threshold boundary.
- `cosmetic-filter` — accepts every approved descriptor; **rejects every blocklisted disease term**
  and any unknown token (a tested compliance invariant, like P1 consent immutability).
- `image-lifecycle` — deletes on success, deletes on thrown error, handles delete failure (retry + marker).
- `scans` client — `recordScan`/`fetch*` against a mocked Supabase.

**Database (pgTAP)**
- `scans` schema + append-only (no update/delete) + RLS isolation (cross-user read denied).
- `record_scan` validates vocabulary server-side, rejects off-vocab insert.
- `delete_my_data` purges the caller's scans (delta-measured, robust to committed rows).
- §15(a) purpose-met trigger fires as specified.
- `backup_purge` — `deletion_audit` populated on delete; reconciliation marks verified-gone; flags unreconciled.

**Integration (node:test, live local Supabase)** — `record_scan` → fetch latest → second user cannot
read first user's scans → `delete_my_data` purges → `deletion_audit` reconciles. (node:test, not
Jest — jest-expo breaks supabase-js, the P1 lesson.)

**Device (manual, physical iPhone — mandatory, `CLAUDE.md` §4)**
- Full capture → read → delete → result; permission-denied path; **confirm the image file is gone
  after the read** (no residue); **confirm no image ever appears in network traffic.**

**Compliance CI** — extend the no-analytics-SDK guard with a **"no image egress" static check** (the
read pipeline must never hand an image URI to Supabase Storage or any network call); run the
`cosmetic-filter` blocklist test in CI.

## 8. Hard gates & escalation

- **Task 0 (backup/PITR purge)** must be built and verified before the camera captures face data
  from anyone other than internal dev devices; external/TestFlight + real model are blocked until it
  is closed AND counsel signs off.
- **No accuracy / efficacy / skin-tone-equity claim** ships in P2 — no validation data exists yet.
- **Escalate to founders** (per `CLAUDE.md` §6) before anything that would put a disease
  name/diagnosis/treatment claim into output, cause the image to leave the device, add an SDK that
  can touch face/skin/score/health data, or capture from anyone under 18.

## 9. Out of scope (later sub-projects)

- Real trained model + balanced Fitzpatrick I–VI test set + fairness/accuracy validation (next).
- Brand-neutral routine + "why this product" chat, scores-only (P3 / build-order step 6).
- Progress re-scan + honest trend + "did this help?" loop (build-order step 7). P2's append-only
  `scans` table and stored numeric values are built to support it without retrofit.
