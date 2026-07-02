# Per-User Personalization ("it learns from you") — Design

**Date:** 2026-07-02
**Status:** Approved by founder (this session)
**Depends on:** scan history persistence (`record_scan` / `fetchScanHistory`, merged), trend loop (PR #16, merged)
**Compliance gate:** none — relative/within-user framing only (see §1)

## 1. Scope & compliance posture

Learn each user's **per-dimension personal normal** from their own scan history and use it to:

1. **Trend/messaging** — express the latest read relative to the user's own baseline
   ("the appearance of redness is up vs. your usual", "hydration look steady for you").
2. **Routine emphasis** — emphasize routine steps whose driving dimensions are unfavorably
   off the user's own normal.

Explicitly **out of scope**:

- Re-scaling or altering the displayed headline 0–1 scores (compliance caution: personalized
  absolute numbers drift toward an implied accuracy claim — same class of risk as the dark
  absolute-age flag).
- Any population comparison ("better than most people"), any accuracy/efficacy claim.
- Any new data collection. This feature consumes **derived scores already persisted** via
  `record_scan`; the raw image never enters this layer (CLAUDE.md §3 boundary untouched).

Because every output is relative and within-user, this does **not** trigger the §6
founder/legal escalation list. All generated copy uses approved cosmetic vocabulary and is
covered by the `findDiseaseTerms` compliance fuzz (same guard as PR #16's trend copy).
Free-form copy is checked with `findDiseaseTerms` — **not** `assertCosmetic`, which also
requires `APPROVED_LABELS` membership and would reject sentence templates.

## 2. Architecture (pure, client-side, recomputed)

No new table, migration, RPC, or backend change. Four new pure modules under
`src/features/personalize/`, mirroring the `computeSkinFreshnessTrend` pattern
(pure function over `fetchScanHistory` output, host-tested):

| Module | Responsibility |
|---|---|
| `types.ts` | `PersonalBaseline`, `PersonalDeviation`, `DeviationStatus`, constants |
| `personal-baseline.ts` | `computePersonalBaseline(history): PersonalBaseline \| null` |
| `personal-deviation.ts` | `computePersonalDeviation(latest, baseline): PersonalDeviation` |
| `personal-copy.ts` | deviations → approved cosmetic phrasing (fixed templates) |
| `emphasize-routine.ts` (under `src/features/recommend/`) | post-pass routine emphasis |

### 2.1 Types

```ts
// src/features/personalize/types.ts
import type { Dimension } from '../../content/cosmetic-vocab';

export interface DimensionBaseline {
  center: number; // median of prior scores, 0..1
  spread: number; // MAD * 1.4826, floored at SPREAD_FLOOR
}

export type PersonalBaseline = Record<Dimension, DimensionBaseline>;

export type DeviationStatus = 'above' | 'below' | 'within';

export interface DimensionDeviation {
  status: DeviationStatus;
  z: number;            // (latest - center) / spread
  favorable: boolean | null; // null when status === 'within' or polarity is 0
}

export type PersonalDeviation = Record<Dimension, DimensionDeviation>;
```

### 2.2 Baseline: `computePersonalBaseline(history)`

- Input: `ScoreSnapshot[]` **newest-first** (matches `fetchScanHistory` ordering, same
  contract as `computeSkinFreshnessTrend`).
- The **latest scan is excluded** — the baseline is built from the *earlier* scans so the
  latest read is compared against priors, not against itself.
- Returns `null` when fewer than `MIN_SCANS` prior scans exist (cold start).
- Per dimension over the priors: `center = median(scores)`,
  `spread = max(MAD(scores) * 1.4826, SPREAD_FLOOR)`.
- Median + MAD (not mean + stddev): robust to a single bad-lighting outlier scan.
- Stub scans (`isStub === true`) are **excluded** from the baseline — canned numbers must
  not teach the personal normal.

### 2.3 Deviation: `computePersonalDeviation(latest, baseline)`

Per dimension:

- `z = (latest[d] - baseline[d].center) / baseline[d].spread` (spread already floored).
- `status`: `above` if `z > Z_THRESHOLD`, `below` if `z < -Z_THRESHOLD`, else `within`.
- `favorable`: derived from the existing `FRESHNESS_POLARITY` (reused from
  `src/features/age/skin-age-trend.ts`, not duplicated):
  - polarity `1` (hydration): `above` → favorable, `below` → unfavorable.
  - polarity `-1` (texture, pores, darkSpots, redness, fineLines, darkCircles):
    `above` → unfavorable, `below` → favorable.
  - polarity `0` (oiliness) or `status === 'within'` → `favorable: null`
    (oiliness still gets a status for routine logic, but is never framed good/bad).

### 2.4 Copy: `personal-copy.ts`

Fixed sentence templates per (dimension, status, favorable) using only appearance
vocabulary — e.g. "the appearance of redness is up compared to your usual",
"hydration look steady for you". A pure function `personalCopy(deviation): string[]`
returning at most `MAX_MESSAGES = 3` lines, unfavorable deviations first. Every template
string is asserted clean via `findDiseaseTerms` in the compliance fuzz suite.

### 2.5 Routine emphasis: `emphasizeRoutine(routine, deviation)`

Post-pass over the built `Routine` — `skincareDomain.buildRoutine` is untouched:

- A step is **emphasized** when any of its `dimensions` has an unfavorable deviation.
- Emphasized steps move to the front of their `am`/`pm` list (stable order otherwise) and
  gain `emphasized: true` (new optional field on `RoutineStep`, absent = not emphasized —
  backward compatible with persisted routines).
- Returns a **new** `Routine` object (immutability rule); never adds/removes steps, only
  reorders/flags — the recommendation content itself stays domain-owned.
- Emphasis is computed **at display time** in the result screen, not persisted: the stored
  routine (written by `record_scan` before deviation exists) remains the canonical
  un-emphasized routine.

## 3. Method constants (provisional, tunable)

One constants block in `types.ts`, documented as heuristic (mirrors the `CAL` convention in
`cv/calibration.ts`):

| Constant | Value | Why |
|---|---|---|
| `MIN_SCANS` | 3 | fewer priors → baseline too noisy; fall back to aggregate trend |
| `SPREAD_FLOOR` | 0.05 | near-identical history must not flag everything as "off" |
| `Z_THRESHOLD` | 1.0 | deviation beyond the user's own normal variation |
| `MAX_MESSAGES` | 3 | messaging stays scannable |

Safe to tune because outputs are relative statements, never absolute claims.

## 4. Integration points

### 4.1 Result screen (`app/scan/result.tsx`)

- With `history.length - 1 >= MIN_SCANS` non-stub priors: show per-dimension personalized
  messaging (from `personalCopy`) and the emphasized routine.
- Cold start (baseline `null`): **exactly today's behavior** — aggregate
  `computeSkinFreshnessTrend` messaging, un-emphasized routine. `computeSkinFreshnessTrend`
  is unchanged and remains the fallback.
- No new fetches: the screen already loads `fetchScanHistory`.

### 4.2 Data flow

```
fetchScanHistory (existing, derived scores only)
   └→ computePersonalBaseline (priors, non-stub)   ── null → cold-start fallback
        └→ computePersonalDeviation (latest vs baseline)
             ├→ personalCopy        → result-screen messaging
             └→ emphasizeRoutine    → displayed routine ordering/flags
```

## 5. Error handling

- Baseline/deviation functions are total: malformed or missing dimension values are treated
  as absent for that dimension (dimension omitted from messaging/emphasis rather than NaN
  propagation); a dimension with no valid priors yields no deviation.
- `history` shorter than 2, all-stub history, or fetch failure → cold-start path (the screen
  already handles fetch errors).

## 6. Testing (TDD, ≥80% coverage)

- **Unit** — median/MAD math incl. even/odd counts; cold-start `null` at `MIN_SCANS - 1`;
  stub-scan exclusion; latest-scan exclusion from baseline; polarity/favorable mapping incl.
  oiliness-null; z classification at/around `Z_THRESHOLD`; spread floor on zero-variance
  history; NaN/missing dimension handling; copy templates for every (dimension, status)
  cell; `MAX_MESSAGES` cap + unfavorable-first ordering; `emphasizeRoutine` reorder/flag,
  immutability (input object unchanged), and no-op when nothing deviates.
- **Integration** — result screen shows personalized messaging with sufficient history and
  falls back below `MIN_SCANS` (RNTL 14: `await render`, press-heavy tests last per repo
  gotchas memory).
- **Adversarial** — one extreme outlier scan does not move the median baseline; all-identical
  history hits the spread floor and reports everything `within`; alternating extremes.
- **Compliance fuzz** — every template string through `findDiseaseTerms` (extend the
  existing `compliance-fuzz` pattern).

## 7. Relationship to the trained-model track

Personalization consumes `ScoreVector`s and is **engine-agnostic**: when the ExecuTorch
model eventually replaces `CvReadEngine` (see companion spec
`2026-07-02-trained-model-track-design.md`), this layer keeps working unchanged. One
interaction to handle at that time: a `modelVersion` change breaks baseline comparability —
the baseline SHOULD then be computed only over scans with the current `modelVersion`
(noted here so the model track's cutover checklist includes it; not built now, YAGNI).
