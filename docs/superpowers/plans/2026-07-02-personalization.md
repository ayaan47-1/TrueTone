# Per-User Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Learn each user's per-dimension "personal normal" from their own scan history and use it for relative trend messaging plus routine-step emphasis, with an exact cold-start fallback to today's behavior.

**Architecture:** Pure client-side modules under `src/features/personalize/` (median+MAD baseline → z-score deviation → cosmetic copy), plus a `emphasizeRoutine` post-pass under `src/features/recommend/`. No new table/migration/RPC — everything recomputes from `fetchScanHistory` output, mirroring the `computeSkinFreshnessTrend` pattern. Display integration: a "Compared to your usual" card on the result screen and emphasized steps on the routine tab, both display-time only.

**Tech Stack:** TypeScript, React Native (Expo SDK 56), jest-expo + @testing-library/react-native 14, NativeWind ("Mist" design system components from `src/components/ui`).

**Spec:** `docs/superpowers/specs/2026-07-02-personalization-design.md`

## Global Constraints

- Cosmetic vocabulary ONLY in user-facing strings; free-form copy is checked with `findDiseaseTerms` (from `src/lib/cosmetic-filter.ts`), **never** `assertCosmetic` (which also requires `APPROVED_LABELS` membership and rejects sentences).
- No population comparison, no accuracy/efficacy claim, no re-scaling of headline scores. All framing is relative/within-user.
- No new data collection, table, migration, RPC, or SDK. Derived scores only; the raw-image boundary (CLAUDE.md §3) is untouched by this feature.
- Immutability: functions return NEW objects; never mutate inputs (`~/.claude/rules/common/coding-style.md`).
- Constants (provisional, heuristic): `MIN_SCANS = 3`, `SPREAD_FLOOR = 0.05`, `Z_THRESHOLD = 1.0`, `MAX_MESSAGES = 3`.
- History arrays are **newest-first** (the `fetchScanHistory` ordering). The latest scan is excluded from the baseline; stub scans (`isStub === true`) are excluded from the baseline.
- RNTL 14: `render(...)` returns a Promise — always `await render(...)`. Press-heavy tests go LAST in their file (repo gotcha: unsettled React work leaks into later tests).
- Test runner: `npx jest <path>` (project uses jest-expo preset via `npm test`).
- Commits: conventional format, NO Co-Authored-By attribution (disabled globally for this user).

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/features/personalize/types.ts` | create | types + method constants |
| `src/features/personalize/personal-baseline.ts` | create | median+MAD baseline from history |
| `src/features/personalize/personal-deviation.ts` | create | z-score classification + favorable flag |
| `src/features/personalize/personal-copy.ts` | create | deviations → approved sentences |
| `src/features/personalize/PersonalCard.tsx` | create | "Compared to your usual" card |
| `src/features/recommend/emphasize-routine.ts` | create | routine emphasis post-pass |
| `src/features/recommend/routine-types.ts` | modify | add optional `emphasized` to `RoutineStep` |
| `src/features/read/Result.tsx` | modify | optional `personalMessages` prop |
| `app/scan/result.tsx` | modify | compute baseline/deviation/copy; fetch 10 |
| `app/(tabs)/routine.tsx` | modify | fetch history; apply `emphasizeRoutine` |
| `src/features/recommend/RoutineView.tsx` | modify | render "Focus today" on emphasized steps |

**UI interpretation (locked during design):** cold start renders *exactly* today's UI (no personal card, un-emphasized routine, aggregate `computeSkinFreshnessTrend` unchanged inside `AgeTrendCard`). With a baseline, the personal card is ADDED to the result screen and routine steps gain emphasis. `AgeTrendCard` is not modified.

---

### Task 1: Types + personal baseline (median + MAD)

**Files:**
- Create: `src/features/personalize/types.ts`
- Create: `src/features/personalize/personal-baseline.ts`
- Test: `src/features/personalize/__tests__/personal-baseline.test.ts`

**Interfaces:**
- Consumes: `Dimension`, `DIMENSIONS` from `src/content/cosmetic-vocab`; `ScoreVector` from `src/features/read/read-types`.
- Produces: `PersonalSnapshot`, `DimensionBaseline`, `PersonalBaseline`, `DeviationStatus`, `DimensionDeviation`, `PersonalDeviation`, constants `MIN_SCANS`/`SPREAD_FLOOR`/`Z_THRESHOLD`/`MAX_MESSAGES` (all from `types.ts`); `computePersonalBaseline(history: PersonalSnapshot[]): PersonalBaseline | null` (from `personal-baseline.ts`). Later tasks import these exact names.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/personalize/__tests__/personal-baseline.test.ts
import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ScoreVector } from '../../read/read-types';
import { computePersonalBaseline } from '../personal-baseline';
import { MIN_SCANS, SPREAD_FLOOR } from '../types';
import type { PersonalSnapshot } from '../types';

const vec = (v: number, overrides: Partial<ScoreVector> = {}): ScoreVector =>
  ({ ...Object.fromEntries(DIMENSIONS.map((d) => [d, v])), ...overrides }) as ScoreVector;

const snap = (v: number, overrides: Partial<ScoreVector> = {}, isStub = false): PersonalSnapshot =>
  ({ scores: vec(v, overrides), isStub });

// history is newest-first; index 0 (the latest) is excluded from the baseline.
describe('computePersonalBaseline', () => {
  test('returns null with fewer than MIN_SCANS non-stub priors', () => {
    // latest + (MIN_SCANS - 1) priors → not enough
    const history = [snap(0.5), ...Array.from({ length: MIN_SCANS - 1 }, () => snap(0.5))];
    expect(computePersonalBaseline(history)).toBeNull();
  });

  test('returns a baseline at exactly MIN_SCANS non-stub priors', () => {
    const history = [snap(0.9), ...Array.from({ length: MIN_SCANS }, () => snap(0.5))];
    const b = computePersonalBaseline(history);
    expect(b).not.toBeNull();
    expect(b!.hydration!.center).toBeCloseTo(0.5);
  });

  test('excludes the latest scan from the baseline', () => {
    // priors all 0.4; latest 0.9 must NOT pull the center
    const history = [snap(0.9), snap(0.4), snap(0.4), snap(0.4)];
    const b = computePersonalBaseline(history)!;
    expect(b.hydration!.center).toBeCloseTo(0.4);
  });

  test('excludes stub scans from the baseline', () => {
    // only 2 non-stub priors → null even though 4 priors exist
    const history = [snap(0.5), snap(0.4), snap(0.4, {}, true), snap(0.4, {}, true), snap(0.4)];
    expect(computePersonalBaseline(history)).toBeNull();
  });

  test('median is robust to a single outlier prior', () => {
    const history = [snap(0.5), snap(0.4), snap(0.4), snap(0.4), snap(0.99)];
    const b = computePersonalBaseline(history)!;
    expect(b.redness!.center).toBeCloseTo(0.4); // median of [0.4, 0.4, 0.4, 0.99]
  });

  test('even-count median averages the two middle values', () => {
    const history = [snap(0.5), snap(0.2), snap(0.4), snap(0.6), snap(0.8)];
    const b = computePersonalBaseline(history)!;
    expect(b.texture!.center).toBeCloseTo(0.5); // median of [0.2, 0.4, 0.6, 0.8]
  });

  test('spread is floored at SPREAD_FLOOR for identical history', () => {
    const history = [snap(0.5), snap(0.5), snap(0.5), snap(0.5)];
    const b = computePersonalBaseline(history)!;
    expect(b.pores!.spread).toBe(SPREAD_FLOOR);
  });

  test('spread reflects MAD * 1.4826 when above the floor', () => {
    // priors: 0.1, 0.5, 0.9 → median 0.5, MAD = median(|x-0.5|) = 0.4 → spread ≈ 0.593
    const history = [snap(0.5), snap(0.1), snap(0.5), snap(0.9)];
    const b = computePersonalBaseline(history)!;
    expect(b.darkSpots!.spread).toBeCloseTo(0.4 * 1.4826, 5);
  });

  test('a dimension with NaN priors is omitted; the rest survive', () => {
    const history = [
      snap(0.5),
      snap(0.4, { hydration: Number.NaN }),
      snap(0.4, { hydration: Number.NaN }),
      snap(0.4),
    ];
    const b = computePersonalBaseline(history)!;
    expect(b.hydration).toBeUndefined(); // only 1 valid hydration prior < MIN_SCANS
    expect(b.redness).toBeDefined();
  });

  test('does not mutate the input history', () => {
    const history = [snap(0.5), snap(0.4), snap(0.3), snap(0.2)];
    const copy = JSON.parse(JSON.stringify(history));
    computePersonalBaseline(history);
    expect(history).toEqual(copy);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/personalize/__tests__/personal-baseline.test.ts`
Expected: FAIL — `Cannot find module '../personal-baseline'`.

- [ ] **Step 3: Write the types module**

```ts
// src/features/personalize/types.ts
// Per-user personalization types + method constants.
// Constants are PROVISIONAL heuristics (same convention as CAL in cv/calibration.ts):
// safe to tune because every output is a relative, within-user statement — never an
// absolute or population claim (spec §1, §3).
import type { Dimension } from '../../content/cosmetic-vocab';
import type { ScoreVector } from '../read/read-types';

/** Minimum non-stub PRIOR scans required before a personal baseline exists. */
export const MIN_SCANS = 3;
/** Spread floor so near-identical history doesn't flag everything as "off". */
export const SPREAD_FLOOR = 0.05;
/** Deviation beyond the user's own normal variation, in spread units. */
export const Z_THRESHOLD = 1.0;
/** Messaging stays scannable. */
export const MAX_MESSAGES = 3;

/** One scan's contribution to the personal history (derived scores only — no image). */
export interface PersonalSnapshot {
  scores: ScoreVector;
  isStub: boolean;
}

export interface DimensionBaseline {
  center: number; // median of prior scores, 0..1
  spread: number; // MAD * 1.4826, floored at SPREAD_FLOOR
}

/** Partial: a dimension without enough valid priors is simply absent. */
export type PersonalBaseline = Partial<Record<Dimension, DimensionBaseline>>;

export type DeviationStatus = 'above' | 'below' | 'within';

export interface DimensionDeviation {
  status: DeviationStatus;
  z: number; // (latest - center) / spread
  favorable: boolean | null; // null when 'within' or when polarity is 0 (oiliness)
}

/** Partial: only dimensions present in the baseline (with a valid latest value) appear. */
export type PersonalDeviation = Partial<Record<Dimension, DimensionDeviation>>;
```

- [ ] **Step 4: Write the baseline implementation**

```ts
// src/features/personalize/personal-baseline.ts
// Per-dimension personal "normal" from the user's OWN scan history (newest-first).
// Median + MAD (not mean + stddev): robust to a single bad-lighting outlier scan.
// Pure and host-tested — mirrors the computeSkinFreshnessTrend pattern.
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import { MIN_SCANS, SPREAD_FLOOR } from './types';
import type { PersonalBaseline, PersonalSnapshot } from './types';

const MAD_SCALE = 1.4826; // makes MAD comparable to a standard deviation

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * history is newest-first (fetchScanHistory ordering). The latest scan (index 0) is
 * excluded — the baseline describes the user's PRIOR normal, so the latest read is
 * compared against it, not against itself. Stub scans never teach the baseline.
 * Returns null on cold start (< MIN_SCANS usable priors).
 */
export function computePersonalBaseline(history: PersonalSnapshot[]): PersonalBaseline | null {
  const priors = history.slice(1).filter((s) => !s.isStub);
  if (priors.length < MIN_SCANS) return null;
  const baseline: PersonalBaseline = {};
  for (const d of DIMENSIONS) {
    const values = priors.map((s) => s.scores[d]).filter((v) => Number.isFinite(v));
    if (values.length < MIN_SCANS) continue; // not enough valid priors for this dimension
    const center = median(values);
    const mad = median(values.map((v) => Math.abs(v - center)));
    baseline[d] = { center, spread: Math.max(mad * MAD_SCALE, SPREAD_FLOOR) };
  }
  return baseline;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/features/personalize/__tests__/personal-baseline.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/personalize/types.ts src/features/personalize/personal-baseline.ts src/features/personalize/__tests__/personal-baseline.test.ts
git commit -m "feat(personalize): per-dimension personal baseline (median + MAD)"
```

---

### Task 2: Deviation classification + favorable polarity

**Files:**
- Create: `src/features/personalize/personal-deviation.ts`
- Test: `src/features/personalize/__tests__/personal-deviation.test.ts`

**Interfaces:**
- Consumes: `PersonalBaseline`, `PersonalDeviation`, `DeviationStatus`, `Z_THRESHOLD` from `./types` (Task 1); `FRESHNESS_POLARITY` from `src/features/age/skin-age-trend` (existing export — reuse, do not duplicate); `ScoreVector`, `DIMENSIONS`.
- Produces: `computePersonalDeviation(latest: ScoreVector, baseline: PersonalBaseline): PersonalDeviation`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/personalize/__tests__/personal-deviation.test.ts
import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ScoreVector } from '../../read/read-types';
import { computePersonalDeviation } from '../personal-deviation';
import type { PersonalBaseline } from '../types';

const vec = (v: number, overrides: Partial<ScoreVector> = {}): ScoreVector =>
  ({ ...Object.fromEntries(DIMENSIONS.map((d) => [d, v])), ...overrides }) as ScoreVector;

// All dimensions baselined at center 0.5, spread 0.1 → z = (latest - 0.5) / 0.1.
const baseline = Object.fromEntries(
  DIMENSIONS.map((d) => [d, { center: 0.5, spread: 0.1 }]),
) as PersonalBaseline;

describe('computePersonalDeviation', () => {
  test('classifies within / above / below around Z_THRESHOLD', () => {
    // z = 1.0 exactly → NOT above (strict >); z = 1.5 → above; z = -1.5 → below
    const dev = computePersonalDeviation(
      vec(0.5, { hydration: 0.6, redness: 0.65, texture: 0.35 }),
      baseline,
    );
    expect(dev.hydration!.status).toBe('within'); // z = 1.0, not strictly above
    expect(dev.redness!.status).toBe('above');    // z = 1.5
    expect(dev.texture!.status).toBe('below');    // z = -1.5
    expect(dev.pores!.status).toBe('within');     // z = 0
  });

  test('reports the signed z value', () => {
    const dev = computePersonalDeviation(vec(0.5, { darkSpots: 0.8 }), baseline);
    expect(dev.darkSpots!.z).toBeCloseTo(3.0);
  });

  test('favorable follows FRESHNESS_POLARITY', () => {
    const dev = computePersonalDeviation(
      vec(0.5, { hydration: 0.8, redness: 0.8, fineLines: 0.2 }),
      baseline,
    );
    expect(dev.hydration!.favorable).toBe(true);  // polarity 1, above → favorable
    expect(dev.redness!.favorable).toBe(false);   // polarity -1, above → unfavorable
    expect(dev.fineLines!.favorable).toBe(true);  // polarity -1, below → favorable
  });

  test('oiliness (polarity 0) gets a status but favorable is null', () => {
    const dev = computePersonalDeviation(vec(0.5, { oiliness: 0.9 }), baseline);
    expect(dev.oiliness!.status).toBe('above');
    expect(dev.oiliness!.favorable).toBeNull();
  });

  test('within deviations have favorable null', () => {
    const dev = computePersonalDeviation(vec(0.5), baseline);
    expect(dev.hydration!.favorable).toBeNull();
  });

  test('dimensions absent from the baseline are omitted', () => {
    const partial: PersonalBaseline = { redness: { center: 0.5, spread: 0.1 } };
    const dev = computePersonalDeviation(vec(0.9), partial);
    expect(dev.redness).toBeDefined();
    expect(dev.hydration).toBeUndefined();
  });

  test('a NaN latest value omits that dimension', () => {
    const dev = computePersonalDeviation(vec(0.5, { pores: Number.NaN }), baseline);
    expect(dev.pores).toBeUndefined();
    expect(dev.redness).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/personalize/__tests__/personal-deviation.test.ts`
Expected: FAIL — `Cannot find module '../personal-deviation'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/personalize/personal-deviation.ts
// Expresses the latest read relative to the user's OWN baseline: z-score per dimension,
// classified above/below/within, with a "favorable" flag derived from the existing
// freshness polarity (reused from skin-age-trend — single source of truth).
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import type { ScoreVector } from '../read/read-types';
import { FRESHNESS_POLARITY } from '../age/skin-age-trend';
import { Z_THRESHOLD } from './types';
import type { DeviationStatus, PersonalBaseline, PersonalDeviation } from './types';

export function computePersonalDeviation(
  latest: ScoreVector,
  baseline: PersonalBaseline,
): PersonalDeviation {
  const deviation: PersonalDeviation = {};
  for (const d of DIMENSIONS) {
    const b = baseline[d];
    const value = latest[d];
    if (!b || !Number.isFinite(value)) continue; // no baseline or malformed latest → omit
    const z = (value - b.center) / b.spread; // spread is already floored by the baseline
    const status: DeviationStatus = z > Z_THRESHOLD ? 'above' : z < -Z_THRESHOLD ? 'below' : 'within';
    const polarity = FRESHNESS_POLARITY[d];
    const favorable =
      status === 'within' || polarity === 0
        ? null
        : polarity === 1
          ? status === 'above'
          : status === 'below';
    deviation[d] = { status, z, favorable };
  }
  return deviation;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/personalize/__tests__/personal-deviation.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/personalize/personal-deviation.ts src/features/personalize/__tests__/personal-deviation.test.ts
git commit -m "feat(personalize): deviation classification with freshness polarity"
```

---

### Task 3: Personal copy + compliance fuzz

**Files:**
- Create: `src/features/personalize/personal-copy.ts`
- Test: `src/features/personalize/__tests__/personal-copy.test.ts`
- Test: `src/features/personalize/__tests__/personal-copy-compliance.test.ts`

**Interfaces:**
- Consumes: `PersonalDeviation`, `MAX_MESSAGES` from `./types`; `DIMENSIONS`, `Dimension`; `findDiseaseTerms` from `src/lib/cosmetic-filter` (signature: `findDiseaseTerms(text: string): string[]`, empty array = clean).
- Produces: `personalCopy(deviation: PersonalDeviation): string[]` — at most `MAX_MESSAGES` sentences, unfavorable first, then favorable, then neutral (oiliness); `within` dimensions produce nothing.

- [ ] **Step 1: Write the failing behavior test**

```ts
// src/features/personalize/__tests__/personal-copy.test.ts
import { personalCopy } from '../personal-copy';
import { MAX_MESSAGES } from '../types';
import type { PersonalDeviation } from '../types';

const dev = (
  entries: Partial<PersonalDeviation>,
): PersonalDeviation => entries as PersonalDeviation;

describe('personalCopy', () => {
  test('within-only deviations produce no messages', () => {
    expect(
      personalCopy(dev({ hydration: { status: 'within', z: 0, favorable: null } })),
    ).toEqual([]);
  });

  test('an unfavorable deviation produces a relative, appearance-only sentence', () => {
    const msgs = personalCopy(
      dev({ redness: { status: 'above', z: 2, favorable: false } }),
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/redness/i);
    expect(msgs[0]).toMatch(/your usual/i);
  });

  test('unfavorable messages come before favorable ones', () => {
    const msgs = personalCopy(
      dev({
        hydration: { status: 'above', z: 2, favorable: true },   // favorable
        fineLines: { status: 'above', z: 2, favorable: false },  // unfavorable
      }),
    );
    expect(msgs[0]).toMatch(/fine lines/i);
    expect(msgs[1]).toMatch(/hydration/i);
  });

  test('neutral (oiliness) comes after favorable and carries no judgment suffix', () => {
    const msgs = personalCopy(
      dev({
        hydration: { status: 'above', z: 2, favorable: true },
        oiliness: { status: 'above', z: 2, favorable: null },
      }),
    );
    expect(msgs[1]).toMatch(/oiliness/i);
    expect(msgs[1]).not.toMatch(/settled|focus/i);
  });

  test('caps output at MAX_MESSAGES', () => {
    const msgs = personalCopy(
      dev({
        redness: { status: 'above', z: 2, favorable: false },
        texture: { status: 'above', z: 2, favorable: false },
        darkCircles: { status: 'above', z: 2, favorable: false },
        pores: { status: 'above', z: 2, favorable: false },
      }),
    );
    expect(msgs).toHaveLength(MAX_MESSAGES);
  });

  test('empty deviation produces no messages', () => {
    expect(personalCopy({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing compliance fuzz test**

Every template output for every reachable (dimension, status, favorable) cell must pass the
disease-term filter. This extends the existing `compliance-fuzz` pattern from
`src/features/age/__tests__/compliance-fuzz.test.ts`.

```ts
// src/features/personalize/__tests__/personal-copy-compliance.test.ts
import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import { FRESHNESS_POLARITY } from '../../age/skin-age-trend';
import { personalCopy } from '../personal-copy';
import type { PersonalDeviation } from '../types';

test('every personalization sentence is free of disease/diagnostic terms', () => {
  for (const d of DIMENSIONS) {
    for (const status of ['above', 'below'] as const) {
      const polarity = FRESHNESS_POLARITY[d];
      const favorable =
        polarity === 0 ? null : polarity === 1 ? status === 'above' : status === 'below';
      const deviation = { [d]: { status, z: 2, favorable } } as PersonalDeviation;
      for (const message of personalCopy(deviation)) {
        expect(findDiseaseTerms(message)).toEqual([]);
      }
    }
  }
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/features/personalize/__tests__/personal-copy.test.ts src/features/personalize/__tests__/personal-copy-compliance.test.ts`
Expected: FAIL — `Cannot find module '../personal-copy'`.

- [ ] **Step 4: Write the implementation**

```ts
// src/features/personalize/personal-copy.ts
// Fixed sentence templates: deviations → approved, appearance-only, relative phrasing.
// Every reachable output is asserted clean via findDiseaseTerms in the compliance fuzz
// (personal-copy-compliance.test.ts). Relative/within-user only — never absolute.
import { DIMENSIONS, type Dimension } from '../../content/cosmetic-vocab';
import { MAX_MESSAGES } from './types';
import type { DimensionDeviation, PersonalDeviation } from './types';

// Appearance-framed display names (spec §2.4). "Appearance of" phrasing on the
// dimensions that describe visible marks, matching the Result screen's sections.
const NAMES: Record<Dimension, string> = {
  hydration: 'Hydration look',
  oiliness: 'Oiliness',
  texture: 'Texture',
  pores: 'Pore visibility',
  darkSpots: 'The appearance of dark spots',
  redness: 'The appearance of redness',
  fineLines: 'The appearance of fine lines',
  darkCircles: 'The appearance of dark circles',
};

function sentence(dimension: Dimension, deviation: DimensionDeviation): string {
  const direction = deviation.status === 'above' ? 'up' : 'down';
  const base = `${NAMES[dimension]} is ${direction} compared to your usual`;
  if (deviation.favorable === true) return `${base} — looking settled.`;
  if (deviation.favorable === false) return `${base} — worth a gentle focus.`;
  return `${base}.`; // neutral (oiliness): no judgment either way
}

// Ordering: unfavorable → favorable → neutral; DIMENSIONS order within each group
// (Array.prototype.sort is stable). Capped at MAX_MESSAGES.
const GROUP_ORDER = (favorable: boolean | null): number =>
  favorable === false ? 0 : favorable === true ? 1 : 2;

export function personalCopy(deviation: PersonalDeviation): string[] {
  return DIMENSIONS
    .map((d) => ({ d, dev: deviation[d] }))
    .filter((x): x is { d: Dimension; dev: DimensionDeviation } =>
      x.dev != null && x.dev.status !== 'within',
    )
    .sort((a, b) => GROUP_ORDER(a.dev.favorable) - GROUP_ORDER(b.dev.favorable))
    .slice(0, MAX_MESSAGES)
    .map(({ d, dev }) => sentence(d, dev));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/features/personalize/__tests__/personal-copy.test.ts src/features/personalize/__tests__/personal-copy-compliance.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/personalize/personal-copy.ts src/features/personalize/__tests__/personal-copy.test.ts src/features/personalize/__tests__/personal-copy-compliance.test.ts
git commit -m "feat(personalize): relative cosmetic copy + disease-term compliance fuzz"
```

---

### Task 4: Routine emphasis post-pass

**Files:**
- Modify: `src/features/recommend/routine-types.ts` (add optional `emphasized` to `RoutineStep`)
- Create: `src/features/recommend/emphasize-routine.ts`
- Test: `src/features/recommend/__tests__/emphasize-routine.test.ts`

**Interfaces:**
- Consumes: `Routine`, `RoutineStep` from `./routine-types`; `PersonalDeviation` from `../personalize/types`.
- Produces: `emphasizeRoutine(routine: Routine, deviation: PersonalDeviation): Routine` — a NEW `Routine`; emphasized steps (any driving dimension unfavorably deviated) move to the front of their `am`/`pm` list with `emphasized: true`; content never added/removed. `RoutineStep` gains `emphasized?: boolean` (absent = not emphasized; backward compatible with persisted routines).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/recommend/__tests__/emphasize-routine.test.ts
import { emphasizeRoutine } from '../emphasize-routine';
import type { Routine, RoutineStep } from '../routine-types';
import type { PersonalDeviation } from '../../personalize/types';

const step = (category: string, dimensions: RoutineStep['dimensions']): RoutineStep =>
  ({ category, habit: 'h', rationale: 'r', dimensions });

const routine: Routine = {
  version: 'skincare-1',
  am: [step('cleanser', ['oiliness']), step('moisturizer', ['hydration']), step('spf', [])],
  pm: [step('pm-cleanser', ['redness'])],
  notes: ['note'],
};

const unfavorableHydration: PersonalDeviation = {
  hydration: { status: 'below', z: -2, favorable: false },
};

describe('emphasizeRoutine', () => {
  test('moves steps driven by unfavorable dimensions to the front, flagged', () => {
    const result = emphasizeRoutine(routine, unfavorableHydration);
    expect(result.am[0].category).toBe('moisturizer');
    expect(result.am[0].emphasized).toBe(true);
    expect(result.am.map((s) => s.category)).toEqual(['moisturizer', 'cleanser', 'spf']);
  });

  test('favorable and within deviations do not emphasize', () => {
    const dev: PersonalDeviation = {
      oiliness: { status: 'above', z: 2, favorable: null },   // neutral
      redness: { status: 'below', z: -2, favorable: true },   // favorable
    };
    const result = emphasizeRoutine(routine, dev);
    expect(result.am.map((s) => s.category)).toEqual(['cleanser', 'moisturizer', 'spf']);
    expect(result.am.every((s) => s.emphasized !== true)).toBe(true);
    expect(result.pm[0].emphasized).toBeUndefined();
  });

  test('never adds or removes steps', () => {
    const result = emphasizeRoutine(routine, unfavorableHydration);
    expect(result.am).toHaveLength(3);
    expect(result.pm).toHaveLength(1);
    expect(result.notes).toEqual(['note']);
    expect(result.version).toBe('skincare-1');
  });

  test('returns a new object and does not mutate the input', () => {
    const before = JSON.parse(JSON.stringify(routine));
    const result = emphasizeRoutine(routine, unfavorableHydration);
    expect(result).not.toBe(routine);
    expect(routine).toEqual(before); // input untouched (immutability rule)
  });

  test('empty deviation is a stable no-op on ordering', () => {
    const result = emphasizeRoutine(routine, {});
    expect(result.am.map((s) => s.category)).toEqual(['cleanser', 'moisturizer', 'spf']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/recommend/__tests__/emphasize-routine.test.ts`
Expected: FAIL — `Cannot find module '../emphasize-routine'`.

- [ ] **Step 3: Add the optional field to `RoutineStep`**

In `src/features/recommend/routine-types.ts`, change the `RoutineStep` interface:

```ts
export interface RoutineStep {
  category: string;   // approved category, e.g. "gentle hydrating cleanser"
  habit: string;      // approved habit, e.g. "use lukewarm water, pat dry"
  rationale: string;  // approved phrasing, e.g. "for the appearance of dryness"
  dimensions: Dimension[]; // which scores drove this step (audit/UX)
  emphasized?: boolean; // display-time personalization flag (never persisted; absent = false)
}
```

- [ ] **Step 4: Write the implementation**

```ts
// src/features/recommend/emphasize-routine.ts
// Display-time personalization post-pass. Reorders/flags steps whose driving dimensions
// are unfavorably off the user's own normal. The domain's buildRoutine is untouched and
// the persisted routine stays canonical — emphasis is computed at render, never stored.
import type { Routine, RoutineStep } from './routine-types';
import type { PersonalDeviation } from '../personalize/types';

export function emphasizeRoutine(routine: Routine, deviation: PersonalDeviation): Routine {
  const isEmphasized = (step: RoutineStep): boolean =>
    step.dimensions.some((d) => deviation[d]?.favorable === false);
  const apply = (steps: RoutineStep[]): RoutineStep[] => [
    ...steps.filter(isEmphasized).map((s) => ({ ...s, emphasized: true })),
    ...steps.filter((s) => !isEmphasized(s)),
  ];
  return { ...routine, am: apply(routine.am), pm: apply(routine.pm) };
}
```

- [ ] **Step 5: Run tests to verify they pass (including no type regressions)**

Run: `npx jest src/features/recommend/__tests__/emphasize-routine.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests); tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/recommend/routine-types.ts src/features/recommend/emphasize-routine.ts src/features/recommend/__tests__/emphasize-routine.test.ts
git commit -m "feat(recommend): display-time routine emphasis from personal deviation"
```

---

### Task 5: PersonalCard + Result prop

**Files:**
- Create: `src/features/personalize/PersonalCard.tsx`
- Modify: `src/features/read/Result.tsx` (add optional `personalMessages` prop)
- Test: `src/features/personalize/__tests__/PersonalCard.test.tsx`
- Test: `src/features/read/__tests__/Result.test.tsx` (extend existing file — add tests, do not rewrite existing ones)

**Interfaces:**
- Consumes: `findDiseaseTerms` from `src/lib/cosmetic-filter`; Mist UI (`GlassCard`, `Display`, `Body`, `Caption` from `src/components/ui`).
- Produces: `PersonalCard({ messages }: { messages: string[] })` — renders nothing when no safe messages; `Result` gains `personalMessages?: string[]` (default absent → identical to today's render), card rendered between the score sections and `AgeTrendCard`.

- [ ] **Step 1: Write the failing PersonalCard test**

```tsx
// src/features/personalize/__tests__/PersonalCard.test.tsx
import { render, screen } from '@testing-library/react-native';
import { PersonalCard } from '../PersonalCard';

describe('PersonalCard', () => {
  test('renders the heading, messages, and relative disclaimer', async () => {
    await render(
      <PersonalCard messages={['The appearance of redness is up compared to your usual — worth a gentle focus.']} />,
    );
    expect(screen.getByText(/compared to your usual/i)).toBeTruthy();
    expect(screen.getByText(/worth a gentle focus/i)).toBeTruthy();
    expect(screen.getByText(/your own recent scans/i)).toBeTruthy();
  });

  test('renders nothing for an empty message list', async () => {
    await render(<PersonalCard messages={[]} />);
    expect(screen.queryByText(/compared to your usual/i)).toBeNull();
  });

  test('runtime guard drops a message containing a blocked term', async () => {
    await render(
      <PersonalCard messages={['this mentions acne and must not render', 'Texture is down compared to your usual.']} />,
    );
    expect(screen.queryByText(/acne/i)).toBeNull();
    expect(screen.getByText(/texture is down/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Write the failing Result prop tests (append to the existing file)**

Append to `src/features/read/__tests__/Result.test.tsx` (keep all existing tests; reuse the
file's existing score-vector helper if one exists, otherwise this local one):

```tsx
// --- personalization card (spec §4.1) ---
import { DIMENSIONS as ALL_DIMS } from '../../../content/cosmetic-vocab';

const flatScores = Object.fromEntries(ALL_DIMS.map((d) => [d, 0.5])) as import('../read-types').ScoreVector;

test('renders the personal card when personalMessages are provided', async () => {
  await render(
    <Result
      scores={flatScores}
      skinType="combination"
      prev={null}
      personalMessages={['Hydration look is down compared to your usual — worth a gentle focus.']}
    />,
  );
  expect(screen.getByText(/compared to your usual/i)).toBeTruthy();
});

test('omits the personal card when personalMessages is absent (cold start = today)', async () => {
  await render(<Result scores={flatScores} skinType="combination" prev={null} />);
  expect(screen.queryByText(/compared to your usual/i)).toBeNull();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/features/personalize/__tests__/PersonalCard.test.tsx src/features/read/__tests__/Result.test.tsx`
Expected: FAIL — `Cannot find module '../PersonalCard'`; unknown prop test fails on missing card text.

- [ ] **Step 4: Write PersonalCard**

```tsx
// src/features/personalize/PersonalCard.tsx
// "Compared to your usual" — relative, within-user messaging from the personal baseline.
// Last-line runtime compliance guard: any message containing a blocked term is dropped
// (templates are also statically fuzz-tested; this is defense in depth).
import { GlassCard, Display, Body, Caption } from '../../components/ui';
import { findDiseaseTerms } from '../../lib/cosmetic-filter';

export function PersonalCard({ messages }: { messages: string[] }) {
  const safe = messages.filter((m) => findDiseaseTerms(m).length === 0);
  if (safe.length === 0) return null;
  return (
    <GlassCard flat intensity={30} radius={22} className="px-5 py-4 mt-6">
      <Display className="text-xl mb-1">Compared to your usual</Display>
      {safe.map((message, i) => (
        <Body key={i} className="text-[13px] text-ink-soft mb-1">
          {message}
        </Body>
      ))}
      <Caption className="text-[11px] leading-[16px] mt-2">
        Relative to your own recent scans — how your skin looks, not a medical read.
      </Caption>
    </GlassCard>
  );
}
```

- [ ] **Step 5: Wire the prop into Result**

In `src/features/read/Result.tsx`:

Add the import:

```tsx
import { PersonalCard } from '../personalize/PersonalCard';
```

Extend `ResultProps`:

```tsx
interface ResultProps {
  scores: ScoreVector;
  skinType: SkinTypeFeel;
  prev: ScoreVector | null; // previous scan for trend arrows (null on first scan)
  history?: ScoreSnapshot[]; // newest-first snapshots for the age/trend card (default: [])
  skinAge?: number | null;   // appearance-age estimate from the latest scan (default: null)
  personalMessages?: string[]; // "compared to your usual" lines (default: none — cold start)
  footer?: ReactNode;        // actions rendered inside the scroll, below the read (e.g. Scan again)
}
```

Update the component signature and render (card sits between the sections and the
age/trend card):

```tsx
export function Result({ scores, skinType, prev, history = [], skinAge = null, personalMessages = [], footer }: ResultProps) {
```

```tsx
      <View className="gap-5 mt-5">
        <Section title="Skin qualities" dims={QUALITY_DIMS} scores={scores} prev={prev} />
        <Section title="Appearance of" dims={APPEARANCE_DIMS} scores={scores} prev={prev} />
      </View>

      <PersonalCard messages={personalMessages} />

      <AgeTrendCard history={history} skinAge={skinAge} />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/features/personalize/__tests__/PersonalCard.test.tsx src/features/read/__tests__/Result.test.tsx`
Expected: PASS (all existing Result tests + 5 new).

- [ ] **Step 7: Commit**

```bash
git add src/features/personalize/PersonalCard.tsx src/features/personalize/__tests__/PersonalCard.test.tsx src/features/read/Result.tsx src/features/read/__tests__/Result.test.tsx
git commit -m "feat(personalize): PersonalCard + Result personalMessages prop"
```

---

### Task 6: Result-route integration (compute + cold-start fallback)

**Files:**
- Modify: `app/scan/result.tsx`
- Test: `app/__tests__/scan-result-route.test.tsx` (extend; ALSO update the existing
  `requests the latest five scans (for trend)` test — the fetch limit changes 5 → 10)

**Interfaces:**
- Consumes: `computePersonalBaseline` (Task 1), `computePersonalDeviation` (Task 2), `personalCopy` (Task 3), the `Result` `personalMessages` prop (Task 5); `Scan` from `src/lib/scans` (has `scores` and `isStub`).
- Produces: the result route passes computed `personalMessages` (or `[]` on cold start) into `Result`, and fetches `fetchScanHistory(10)` so `MIN_SCANS` priors are reachable.

- [ ] **Step 1: Update + add failing route tests**

In `app/__tests__/scan-result-route.test.tsx`:

(a) Change the existing fetch-limit assertion:

```ts
test('requests the latest ten scans (trend + personalization)', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1')]);
  await render(<ResultRoute />);
  await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalledWith(10));
});
```

(b) Append new tests. NOTE the existing `scan()` helper defaults `isStub: true` — the
personalization scans must override it to `false` (stub scans never teach the baseline),
and this file's press-heavy feedback tests must stay LAST in the file (repo gotcha):

```ts
test('shows the personal card once MIN_SCANS non-stub priors exist and a dimension deviates', async () => {
  // Priors: redness 0.4 across 3 non-stub scans (spread → floor 0.05).
  // Latest: redness 0.9 → z = 10 → above, unfavorable → message renders.
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { isStub: false, scores: { ...scores, redness: 0.9 } }),
    scan('s2', { isStub: false, scores: { ...scores, redness: 0.4 } }),
    scan('s3', { isStub: false, scores: { ...scores, redness: 0.4 } }),
    scan('s4', { isStub: false, scores: { ...scores, redness: 0.4 } }),
  ]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/compared to your usual/i)).toBeTruthy());
  expect(screen.getByText(/redness is up compared to your usual/i)).toBeTruthy();
});

test('cold start (too few priors) renders no personal card', async () => {
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { isStub: false }),
    scan('s2', { isStub: false }),
  ]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/not a medical diagnosis/i)).toBeTruthy());
  expect(screen.queryByText(/compared to your usual/i)).toBeNull();
});

test('stub priors never teach the baseline (no personal card)', async () => {
  // 3 priors exist but all stubs → baseline null → cold-start UI.
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { isStub: false, scores: { ...scores, redness: 0.9 } }),
    scan('s2'), // isStub: true by default
    scan('s3'),
    scan('s4'),
  ]);
  await render(<ResultRoute />);
  await waitFor(() => expect(screen.getByText(/not a medical diagnosis/i)).toBeTruthy());
  expect(screen.queryByText(/compared to your usual/i)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest app/__tests__/scan-result-route.test.tsx`
Expected: FAIL — fetch called with 5 (not 10); personal card never renders.

- [ ] **Step 3: Wire the route**

In `app/scan/result.tsx`:

Add imports:

```tsx
import { computePersonalBaseline } from '../../src/features/personalize/personal-baseline';
import { computePersonalDeviation } from '../../src/features/personalize/personal-deviation';
import { personalCopy } from '../../src/features/personalize/personal-copy';
```

Add state next to the other `useState` calls:

```tsx
const [personalMessages, setPersonalMessages] = useState<string[]>([]);
```

In the effect, change the fetch limit and compute messages after the existing `setSkinAge`
line (before `setLatestId`):

```tsx
const history = await fetchScanHistory(10); // trend + enough priors for personalization
```

```tsx
// Personalization: relative to the user's own prior scans (spec §4.1).
// Cold start (baseline null) → no messages → today's UI exactly.
const baseline = computePersonalBaseline(
  history.map((s) => ({ scores: s.scores, isStub: s.isStub })),
);
setPersonalMessages(
  baseline ? personalCopy(computePersonalDeviation(latest.scores, baseline)) : [],
);
```

Pass the prop in the final render:

```tsx
    <Result
      scores={scores}
      skinType={skinType}
      prev={prev}
      history={trendHistory}
      skinAge={skinAge}
      personalMessages={personalMessages}
      footer={
```

- [ ] **Step 4: Run the route tests to verify they pass**

Run: `npx jest app/__tests__/scan-result-route.test.tsx app/__tests__/result-route-hardened.test.tsx`
Expected: PASS (all existing + 3 new; the hardened suite still passes untouched).

- [ ] **Step 5: Commit**

```bash
git add app/scan/result.tsx app/__tests__/scan-result-route.test.tsx
git commit -m "feat(personalize): result route computes personal messages with cold-start fallback"
```

---

### Task 7: Routine-route integration + emphasized rendering

**Files:**
- Modify: `app/(tabs)/routine.tsx` (fetch history; apply `emphasizeRoutine`)
- Modify: `src/features/recommend/RoutineView.tsx` (render "Focus today" on emphasized steps)
- Test: `app/__tests__/routine-route.test.tsx` (rework mocks: `fetchLatestScan` → `fetchScanHistory`)
- Test: `src/features/recommend/__tests__/RoutineView.test.tsx` (extend)

**Interfaces:**
- Consumes: `computePersonalBaseline`, `computePersonalDeviation` (Tasks 1–2), `emphasizeRoutine` (Task 4), `fetchScanHistory` + `Scan` from `src/lib/scans`, `RoutineStep.emphasized`.
- Produces: the routine tab displays the emphasized routine when a baseline exists, and the plain stored routine on cold start. The persisted routine is never modified.

- [ ] **Step 1: Extend the RoutineView test (append to existing file)**

```tsx
// append to src/features/recommend/__tests__/RoutineView.test.tsx
test('marks emphasized steps with a Focus today label', async () => {
  const routine = {
    version: 'skincare-1',
    am: [
      { category: 'gentle hydrating cleanser', habit: 'h', rationale: 'r', dimensions: [], emphasized: true },
      { category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'h', rationale: 'r', dimensions: [] },
    ],
    pm: [],
    notes: [],
  };
  await render(<RoutineView routine={routine} />);
  expect(screen.getAllByText(/focus today/i)).toHaveLength(1);
});

test('renders no Focus label when nothing is emphasized', async () => {
  const routine = {
    version: 'skincare-1',
    am: [{ category: 'gentle hydrating cleanser', habit: 'h', rationale: 'r', dimensions: [] }],
    pm: [],
    notes: [],
  };
  await render(<RoutineView routine={routine} />);
  expect(screen.queryByText(/focus today/i)).toBeNull();
});
```

- [ ] **Step 2: Rework the routine-route test file**

Replace the mock setup and scan fixture in `app/__tests__/routine-route.test.tsx` — the
route switches from `fetchLatestScan` to `fetchScanHistory`. Full replacement file
(preserving all existing behaviors under the new mock, adding personalization cases;
the press test stays LAST):

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { DIMENSIONS } from '../../src/content/cosmetic-vocab';
import type { ScoreVector } from '../../src/features/read/read-types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockFetchScanHistory = jest.fn();
jest.mock('../../src/lib/scans', () => ({
  fetchScanHistory: (...args: unknown[]) => mockFetchScanHistory(...args),
}));

import RoutineRoute from '../(tabs)/routine';

const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ScoreVector;

function scan(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    capturedAt: '2026-07-02T00:00:00Z',
    skinType: 'dry',
    scores,
    modelVersion: 'cv-1',
    isStub: false,
    skinAge: null,
    skinAgeConfidence: null,
    routineHelpful: null,
    routine: {
      version: 'skincare-1',
      am: [
        { category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'am', rationale: 'r', dimensions: [] },
        { category: 'gentle hydrating cleanser', habit: 'am', rationale: 'r', dimensions: ['hydration'] },
      ],
      pm: [],
      notes: [],
    },
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

test('renders the latest scan routine', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1')]);
  await render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
});

test('shows a retry state when the fetch fails', async () => {
  mockFetchScanHistory.mockRejectedValue(new Error('network'));
  await render(<RoutineRoute />);
  expect(await screen.findByText(/couldn.t load your routine/i)).toBeTruthy();
});

test('shows the empty state with no scans', async () => {
  mockFetchScanHistory.mockResolvedValue([]);
  await render(<RoutineRoute />);
  expect(await screen.findByText(/no scan yet/i)).toBeTruthy();
});

test('emphasizes routine steps when the user deviates unfavorably from their baseline', async () => {
  // Priors: hydration 0.8 across 3 non-stub scans; latest 0.2 → below, unfavorable
  // → the hydration-driven cleanser step is emphasized and moves first.
  mockFetchScanHistory.mockResolvedValue([
    scan('s1', { scores: { ...scores, hydration: 0.2 } }),
    scan('s2', { scores: { ...scores, hydration: 0.8 } }),
    scan('s3', { scores: { ...scores, hydration: 0.8 } }),
    scan('s4', { scores: { ...scores, hydration: 0.8 } }),
  ]);
  await render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/focus today/i)).toBeTruthy());
});

test('cold start renders the stored routine order with no emphasis', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1'), scan('s2')]);
  await render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
  expect(screen.queryByText(/focus today/i)).toBeNull();
});

// Press-heavy test LAST in the file (repo gotcha: unsettled React work leaks forward).
test('navigates to /scan/chat with the scanId when the button is pressed', async () => {
  mockFetchScanHistory.mockResolvedValue([scan('s1')]);
  await render(<RoutineRoute />);
  const button = await screen.findByText(/ask about your routine/i);
  fireEvent.press(button);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/scan/chat', params: { scanId: 's1' } });
});
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `npx jest app/__tests__/routine-route.test.tsx src/features/recommend/__tests__/RoutineView.test.tsx`
Expected: FAIL — route still imports `fetchLatestScan`; no "Focus today" rendering.

- [ ] **Step 4: Update RoutineView**

In `src/features/recommend/RoutineView.tsx`, replace the `Step` component:

```tsx
function Step({ step }: { step: RoutineStep }) {
  return (
    <View className="mb-3 last:mb-0">
      {step.emphasized ? (
        <Caption className="text-[10px] uppercase tracking-wide text-ink-muted mb-0.5">
          Focus today
        </Caption>
      ) : null}
      <Body className="font-body-semibold text-ink">{step.category}</Body>
      <Caption className="text-[13px] text-ink-muted mt-0.5">{step.habit} — {step.rationale}</Caption>
    </View>
  );
}
```

- [ ] **Step 5: Update the routine route**

Replace the data-loading portion of `app/(tabs)/routine.tsx` (the `StateCard` helper and
the render return stay as they are):

```tsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchScanHistory, type Scan } from '../../src/lib/scans';
import { RoutineView } from '../../src/features/recommend/RoutineView';
import { computePersonalBaseline } from '../../src/features/personalize/personal-baseline';
import { computePersonalDeviation } from '../../src/features/personalize/personal-deviation';
import { emphasizeRoutine } from '../../src/features/recommend/emphasize-routine';
import type { Routine } from '../../src/features/recommend/routine-types';
import { MistBackground, GlassCard, Body } from '../../src/components/ui';
```

```tsx
export default function RoutineRoute() {
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true; // guard against setState after unmount
    void (async () => {
      try {
        const history = await fetchScanHistory(10);
        if (!active) return;
        const latest = history[0] ?? null;
        setScan(latest);
        if (latest) {
          // Display-time emphasis from the personal baseline; the stored routine stays
          // canonical. Cold start (baseline null) → the plain routine, exactly as today.
          const baseline = computePersonalBaseline(
            history.map((s) => ({ scores: s.scores, isStub: s.isStub })),
          );
          setRoutine(
            baseline
              ? emphasizeRoutine(latest.routine, computePersonalDeviation(latest.scores, baseline))
              : latest.routine,
          );
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <StateCard>Loading…</StateCard>;
  if (failed) return <StateCard>Couldn&rsquo;t load your routine. Pull to retry.</StateCard>;
  if (!scan || !routine) return <StateCard>No scan yet — run a scan to see your routine.</StateCard>;
  return (
    <RoutineView
      routine={routine}
      onAsk={() => router.push({ pathname: '/scan/chat', params: { scanId: scan.id } })}
    />
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest app/__tests__/routine-route.test.tsx src/features/recommend/__tests__/RoutineView.test.tsx`
Expected: PASS (6 route tests + all RoutineView tests incl. 2 new).

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/routine.tsx" src/features/recommend/RoutineView.tsx app/__tests__/routine-route.test.tsx src/features/recommend/__tests__/RoutineView.test.tsx
git commit -m "feat(personalize): routine tab applies display-time emphasis from personal baseline"
```

---

### Task 8: Full verification + docs sync

**Files:**
- Modify: `docs/ARCHITECTURE.md` (add the personalize module to the module map)
- Modify: `README.md` (only if it lists feature modules — mirror whatever pattern exists)

- [ ] **Step 1: Full test suite**

Run: `npx jest`
Expected: ALL suites pass (the pre-existing ~336 tests + the new personalization suites). If any unrelated suite fails, STOP and investigate before proceeding — do not "fix" unrelated tests to green.

- [ ] **Step 2: Types + compliance gates**

Run: `npx tsc --noEmit && npm run check:compliance && npm run check:no-egress`
Expected: all clean (no new deps, no egress, no analytics SDK).

- [ ] **Step 3: Coverage on the new modules**

Run: `npx jest --coverage --collectCoverageFrom='src/features/personalize/**/*.{ts,tsx}' --collectCoverageFrom='src/features/recommend/emphasize-routine.ts' src/features/personalize src/features/recommend`
Expected: ≥ 80% lines/branches on every new file (they are pure — expect ~100%).

- [ ] **Step 4: Docs sync**

In `docs/ARCHITECTURE.md`, add a row/entry for the personalize module following the doc's
existing module-map format:

```
`src/features/personalize/` — per-user personal baseline (median+MAD over the user's own
non-stub scan history), deviation classification vs FRESHNESS_POLARITY, and relative
"compared to your usual" copy; `src/features/recommend/emphasize-routine.ts` applies
display-time routine emphasis. Pure client-side; derived scores only; cold start
(< 3 priors) falls back to the aggregate freshness trend.
```

Check `README.md` for a feature/module list and mirror the same one-liner if (and only if)
such a list exists.

- [ ] **Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md README.md
git commit -m "docs: add personalization module to architecture map"
```

---

## Self-Review (done at plan-writing time)

- **Spec coverage:** §2 modules → Tasks 1–5; §2.5 emphasis → Task 4; §3 constants → Task 1; §4.1 result screen + cold start → Tasks 5–6; §4.1 routine emphasis display → Task 7; §5 error handling (NaN/short/stub/all-stub) → Tasks 1, 2, 6; §6 testing incl. adversarial (outlier, zero-spread) → Tasks 1–7; compliance fuzz → Task 3; runtime guard → Task 5. §7 (modelVersion interplay) is explicitly YAGNI — no task, by design.
- **Placeholder scan:** no TBDs; every code step shows complete code; exact commands with expected outcomes.
- **Type consistency:** `PersonalSnapshot`/`PersonalBaseline`/`PersonalDeviation` names and shapes match across Tasks 1→7; `computePersonalBaseline(history)` / `computePersonalDeviation(latest, baseline)` / `personalCopy(deviation)` / `emphasizeRoutine(routine, deviation)` signatures used identically everywhere; `emphasized?: boolean` defined in Task 4 before first use in Tasks 4/7.
