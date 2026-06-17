# TrueTone — Balanced Skin-Tone Test Set + Fairness Eval Harness (Design Spec)

> **Status:** Approved in brainstorming 2026-06-16. Engineering + compliance design, NOT legal
> advice — a licensed Illinois privacy/biometric attorney must sign off on data sourcing, licensing,
> and subject consent before any real image is used. Read alongside `CLAUDE.md` and the P2 spec
> `docs/superpowers/specs/2026-06-16-truetone-p2-guided-capture-design.md`.

## 1. Summary

This is the first component of sub-project 3 (real model + fairness validation): a **Fitzpatrick
I–VI balanced eval dataset structure + a fairness-evaluation harness**. CLAUDE.md §5 requires a
balanced skin-tone test set built in parallel with the read; equal performance across Fitzpatrick
I–VI is the product, and CLAUDE.md §1/§6 make **any** skin-tone-equity claim a launch blocker without
backing validation data on file and a hard escalate-to-founders item.

**Scope of THIS spec:** the labeling schema, dataset layout, and a host/CI-run harness that runs the
on-device read (`ReadEngine`) + quality gate over a labeled set and reports **per-Fitzpatrick**
fairness metrics against provisional acceptance thresholds. The harness is `ReadEngine`-agnostic: it
runs against today's **stub** (which proves the harness, not fairness) and the real model later,
unchanged.

**Out of scope (separate brainstorms):** the real trained model; the production data-collection
program; publishing any equity claim.

## 2. Locked decisions (from brainstorming 2026-06-16)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope | Eval **dataset structure + fairness harness** only; model is a separate brainstorm |
| 2 | Data sourcing | **Hybrid** — dataset-agnostic harness; seed dev with a small *consented public* fairness set for a baseline; **self-collected in-domain consented data required before any public equity claim**; synthetic only as a CI fixture, never as claim evidence. **Specific source = counsel-gated.** |
| 3 | Fairness metric | **Multi-axis** — quality-gate/face-detection **parity** + score-**stability** parity + systematic-**bias** check; acceptance = worst FST group within tolerance of best, per axis |
| 4 | Data handling | **Host/CI-run; eval images local-only & gitignored, never in production Supabase; aggregate-only report committed**; periodic on-device spot-checks confirm host≈device parity |
| 5 | Ownership | Engineering owns schema/harness/metrics; **data sourcing, licensing, subject consent = founder + counsel sign-off** |
| 6 | Scale | **Fitzpatrick I–VI** (CLAUDE.md-mandated), with recorded label provenance |

## 3. Architecture & the compliance boundary

```
eval/ (dev tool — NOT shipped in the app bundle)
  manifest (FST + subjectId + lighting + source + consentRef)   ← validated, required fields
    → run-eval.ts: for each image, run ReadEngine + quality gate (image→features adapter, DI)
      → per-image results (scores + gate report)   ← stay LOCAL, never committed
        → aggregate per-Fitzpatrick metrics (gate parity / stability / bias)
          → FairnessReport → eval/reports/<date>-fairness.{md,json}   ← AGGREGATE ONLY, committed
─────────── boundary: raw eval images never enter git or production Supabase ───────────
```

The boundary mirrors production (`CLAUDE.md` §3): the raw images stay on the developer's
machine/secure store; only **derived aggregate metrics** are persisted/committed. The
image→features/scores step is an **injected adapter** — fixture-fed today, real host/device inference
when the model lands — so the aggregation + metric layer is buildable and CI-testable now.

## 4. Components & file structure (`eval/`)

A separate top-level `eval/` directory keeps this dev tool out of `app/`/`src/` (never bundled).

- `eval/fairness/fst.ts` — `Fitzpatrick` type (`'I'|'II'|'III'|'IV'|'V'|'VI'`) + helpers (ordering, index).
- `eval/fairness/manifest.ts` — the manifest **schema** + a validator. Each entry:
  `{ imageRef: string; fst: Fitzpatrick; subjectId: string; lighting: string; source: string;
  consentRef: string; fstProvenance: 'self-report' | 'annotated' | 'estimated' }`. Validation fails
  fast on a missing/invalid field (esp. `fst` and `consentRef`). Uses `zod` (dev dependency).
- `eval/fairness/gate-parity.ts` — *pure*: per-image gate results + FST → per-FST pass rate, best/worst
  group, gap.
- `eval/fairness/stability.ts` — *pure*: per-subject repeated-capture score sets + FST → intra-subject
  variance per dimension, aggregated per FST, + parity gap.
- `eval/fairness/bias.ts` — *pure*: correlation between FST index and each tone-independent dimension →
  flag where |corr| exceeds a bound.
- `eval/fairness/thresholds.ts` — provisional acceptance thresholds (constants), documented as
  **policy-owned, provisional pending validation** (a domain expert + counsel set the real values).
- `eval/fairness/metrics.ts` — combine the three axes into a `FairnessReport`
  (`{ perAxis: { gate, stability, bias }, pass: boolean, generatedAt }`), applying thresholds + the
  min-sample rule.
- `eval/fairness/run-eval.ts` — runner: load + validate manifest, run the injected `ReadEngine` +
  quality gate over each image via the features adapter, aggregate, hand off to the report writer.
  Takes the `ReadEngine` + adapter by dependency injection (stub/real swap).
- `eval/fairness/report.ts` — render `FairnessReport` → `eval/reports/<YYYY-MM-DD>-fairness.md` + JSON.
  **Aggregate only**; refuses to emit per-subject rows.
- `eval/data/` — **gitignored.** Local images + the manifest live here. A committed
  `eval/data/README.md` documents the expected layout and the rules: real faces are never committed,
  every entry needs a `consentRef`, and the specific source/license needs counsel sign-off.
- `eval/fixtures/` — tiny **synthetic** fixtures (committed): a small synthetic manifest + precomputed
  feature/score inputs so the harness and all pure metrics run in CI without any real faces.
- `eval/fairness/__tests__/` — unit tests for the pure modules + a harness smoke test.

Reuses from the app: the P2 `ReadEngine` interface (`src/features/read/read-engine.ts`) and
`evaluateQuality` (`src/features/capture/quality-gate.ts`). The harness imports these; it does **not**
duplicate read or gate logic.

## 5. Labeling schema

Per image, the manifest records: **Fitzpatrick I–VI** (the CLAUDE.md-mandated scale), `subjectId`
(enables intra-subject stability), `lighting` condition, `source`, a required `consentRef` (pointer to
the consent/license record), and `fstProvenance` (how the FST label was assigned —
self-report / dataset-annotated / estimated). FST labels are taken from the source's own annotations
or self-report; the harness never infers FST itself for labeling purposes.

## 6. Metrics & acceptance criteria (all thresholds provisional, policy-owned)

- **Gate parity** — per-FST quality-gate pass rate (face detected + lighting + focus + distance).
  Criterion: every group ≥ an absolute floor **and** worst-group within Δ of best-group. *(Measurable
  today against the stub/adapter; the classic, objective fairness axis — face detection / lighting
  failing more on darker skin.)*
- **Stability** — intra-subject score variance per dimension, aggregated per FST (same subject,
  varied lighting/pose). Criterion: the worst FST group is no less stable than the best beyond a
  tolerance. *(Comes online with the real model.)*
- **Systematic bias** — correlation between FST index and tone-independent dimensions ≈ 0; flag where
  |corr| exceeds a bound. *(Comes online with the real model; refined with domain input.)*
- **Min-sample guard** — a group below a minimum N reports "insufficient sample," never a noisy or
  potentially re-identifying statistic.

The harness **reports numbers**; the pass/fail **policy** (threshold values) is owned by the founders
+ counsel + a domain expert and recorded in `thresholds.ts` with its provisional status.

## 7. Error handling & hygiene

- **Manifest validation** fails fast: missing/invalid `fst`, missing `consentRef`, or an unreadable
  `imageRef` aborts the run with a clear error.
- **No image egress:** the harness refuses to write any image to a committed path; the report contains
  aggregates only (no per-subject rows). `eval/data/` is gitignored.
- **Git-hygiene guard:** a test/CI check asserts no image-extension files are tracked under `eval/`.
- **Min-sample:** per-FST metrics are suppressed (reported as insufficient) below the configured N.

## 8. Testing

- **Unit (pure):** `gate-parity`, `stability`, `bias`, and `metrics` aggregation against synthetic
  fixture inputs with known FST labels — assert per-group rates, best/worst gaps, threshold pass/fail,
  and min-sample suppression.
- **Harness smoke:** `run-eval` over `eval/fixtures` with a trivial `ReadEngine`/adapter → produces a
  valid aggregate `FairnessReport` (no real faces, CI-safe).
- **Hygiene guard:** `eval/data/` gitignored; no image files tracked under `eval/`.
- These run in CI (host); on-device spot-checks (a small manifest run through the real on-device read)
  validate host≈device parity once the real model + device path exist.

## 9. Hard gates & escalation

- **Founder + counsel sign-off** on the specific dataset/source, its license, and subject consent
  (BIPA/PIPA) **before any real image is used.** Engineering builds the structure; it does not choose
  or ingest a source unilaterally.
- **No equity claim** ships from stub or public-dataset results alone. A public skin-tone-equity claim
  requires the **self-collected in-domain consented corpus** + sign-off (FTC §5 / ICFA). The stub
  baseline proves the harness works, not that the product is fair.
- **No raw eval images in git or the production backend, ever.**
- Escalate (per `CLAUDE.md` §6) before sourcing real faces, before any claim, and if the eval would
  require storing images anywhere shared/cloud.

## 10. Out of scope (later)

- The real trained model and its host/device inference path (separate brainstorm; the harness's
  feature/score adapter is the seam it plugs into).
- The production participant data-collection + consent program (founder + legal program, not code).
- Authoring or publishing any equity/accuracy claim.
