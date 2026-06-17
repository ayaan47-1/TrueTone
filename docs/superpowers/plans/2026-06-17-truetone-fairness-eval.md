# TrueTone — Fairness Eval (Balanced Skin-Tone Test Set + Harness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fitzpatrick I–VI labeling schema + a host/CI-run fairness-eval harness that aggregates per-Fitzpatrick metrics (quality-gate parity, score stability, systematic bias) from labeled observations, with raw images never entering git or the backend.

**Architecture:** A standalone `eval/` dev tool (never bundled). Pure metric modules consume `Observation[]` (FST + subjectId + gate report + scores); a runner produces observations from a manifest via an **injected extractor** (fixture-fed now; the real image→read adapter is gated on the model + counsel-approved data). Only aggregate reports are committed.

**Tech Stack:** TypeScript · Jest 29 (host) · zod (manifest validation) · reuses `src/features/capture/quality-gate.ts` (`QualityReport`) + `src/content/cosmetic-vocab.ts` (`DIMENSIONS`) + `src/features/read/read-types.ts` (`ScoreVector`).

---

## READ FIRST — context for the executing engineer

- **Spec:** `docs/superpowers/specs/2026-06-16-truetone-fairness-eval-design.md`. Read it; the decisions table (§2), metrics (§6), and hard gates (§9) govern this plan.
- **This is a DEV TOOL in a new top-level `eval/` directory.** It is never imported by `app/` or `src/` and never shipped. It reuses a few *types/pure functions* from `src/` but adds nothing to the app bundle.
- **The compliance boundary holds by construction:** raw eval images never enter git or production Supabase. Only aggregate reports (no per-subject rows) are committed. `eval/data/` is gitignored; a guard test enforces "no images tracked under `eval/`".
- **Buildable-now vs gated:** everything in this plan is host/CI-testable on **synthetic fixtures**. The *real* extractor (decode an approved image → run the on-device read → `{gate, scores}`) is **out of scope** — gated on (a) the real model + host/device inference path and (b) counsel-approved image sourcing. The runner takes the extractor by injection so the real one drops in later.
- **Thresholds are PROVISIONAL and policy-owned** (founders + counsel + a domain expert). The harness reports numbers; it does not certify fairness. The stub/synthetic baseline proves the harness, not the product.
- **Conventions:** match the codebase — explicit types on exports, `as const` for constant tables, small focused files, no `console.log` in library code, Jest with real behavioral assertions. Run a single suite with `npm test -- <name>`.
- **Imports from app code** use repo-root-relative paths from `eval/fairness/`: e.g. `../../src/features/capture/quality-gate`.

---

## File Structure (locked)

```
eval/
  fairness/
    fst.ts                 # Fitzpatrick type + ordering + index
    types.ts               # Observation (the unit the metrics consume)
    manifest.ts            # zod manifest schema + parseManifest
    gate-parity.ts         # pure: per-FST quality-gate pass-rate parity
    stability.ts           # pure: per-FST intra-subject score stability
    bias.ts                # pure: corr(FST, score) per dimension
    thresholds.ts          # provisional, policy-owned constants
    metrics.ts             # combine axes -> FairnessReport
    run-eval.ts            # runner: manifest + injected extractor -> Observation[]
    report.ts              # render FairnessReport -> md + json (aggregate only)
    run-fixtures.ts        # build a synthetic Observation[] -> report (demo + smoke)
    __tests__/             # unit tests for each pure module + the smoke test
  data/                    # GITIGNORED: real images + manifest live here (never committed)
    README.md              # layout + "never commit faces / consent + license required" rules
  reports/                 # committed aggregate reports (no per-subject data)
    .gitkeep
  __tests__/
    hygiene.test.ts        # asserts no image files tracked under eval/
```

---

## Task 1: Fitzpatrick scale

**Files:** Create `eval/fairness/fst.ts`; Test `eval/fairness/__tests__/fst.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// eval/fairness/__tests__/fst.test.ts
import { FITZPATRICK, fstIndex, isFitzpatrick } from '../fst';

test('there are six Fitzpatrick types in order', () => {
  expect([...FITZPATRICK]).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI']);
});
test('fstIndex is 1-based', () => {
  expect(fstIndex('I')).toBe(1);
  expect(fstIndex('VI')).toBe(6);
});
test('isFitzpatrick narrows valid values only', () => {
  expect(isFitzpatrick('IV')).toBe(true);
  expect(isFitzpatrick('VII')).toBe(false);
  expect(isFitzpatrick(4)).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- fst`
Expected: FAIL — cannot find module `../fst`.

- [ ] **Step 3: Implement**

```typescript
// eval/fairness/fst.ts
export type Fitzpatrick = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

export const FITZPATRICK: readonly Fitzpatrick[] = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export function fstIndex(f: Fitzpatrick): number {
  return FITZPATRICK.indexOf(f) + 1; // 1..6
}

export function isFitzpatrick(v: unknown): v is Fitzpatrick {
  return typeof v === 'string' && (FITZPATRICK as readonly string[]).includes(v);
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- fst` → PASS.
- [ ] **Step 5: Commit**

```bash
git add eval/fairness/fst.ts eval/fairness/__tests__/fst.test.ts
git commit -m "feat(eval): Fitzpatrick scale type + helpers"
```

---

## Task 2: Observation type + manifest schema

**Files:** Create `eval/fairness/types.ts`, `eval/fairness/manifest.ts`; Test `eval/fairness/__tests__/manifest.test.ts`; Modify `package.json` (zod devDep).

- [ ] **Step 1: Ensure zod is an explicit dev dependency**

Run: `npm install -D zod`
Expected: zod in `devDependencies`.

- [ ] **Step 2: Write the failing test**

```typescript
// eval/fairness/__tests__/manifest.test.ts
import { parseManifest } from '../manifest';

const valid = [{
  imageRef: 'subjA/img1.jpg', fst: 'IV', subjectId: 'subjA',
  lighting: 'indoor-window', source: 'public-consented-set-x',
  consentRef: 'consent-row-123', fstProvenance: 'annotated',
}];

test('parses a valid manifest', () => {
  const out = parseManifest(valid);
  expect(out).toHaveLength(1);
  expect(out[0].fst).toBe('IV');
});
test('rejects an invalid Fitzpatrick value', () => {
  expect(() => parseManifest([{ ...valid[0], fst: 'VII' }])).toThrow();
});
test('rejects a missing consentRef (required for every image)', () => {
  const { consentRef, ...noConsent } = valid[0];
  expect(() => parseManifest([noConsent])).toThrow();
});
```

- [ ] **Step 3: Run to verify it fails** — `npm test -- manifest` → FAIL (module missing).

- [ ] **Step 4: Implement**

```typescript
// eval/fairness/types.ts
import type { Fitzpatrick } from './fst';
import type { QualityReport } from '../../src/features/capture/quality-gate';
import type { ScoreVector } from '../../src/features/read/read-types';

// One labeled, evaluated image. The metrics consume arrays of these.
export interface Observation {
  fst: Fitzpatrick;
  subjectId: string;
  gate: QualityReport;
  scores: ScoreVector;
}
```

```typescript
// eval/fairness/manifest.ts
import { z } from 'zod';

// Every entry must carry an FST label and a consentRef; consentRef points at the
// consent/license record (BIPA/PIPA) — its presence is enforced here, its validity is a legal gate.
export const ManifestEntrySchema = z.object({
  imageRef: z.string().min(1),
  fst: z.enum(['I', 'II', 'III', 'IV', 'V', 'VI']),
  subjectId: z.string().min(1),
  lighting: z.string().min(1),
  source: z.string().min(1),
  consentRef: z.string().min(1),
  fstProvenance: z.enum(['self-report', 'annotated', 'estimated']),
});
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export function parseManifest(raw: unknown): ManifestEntry[] {
  return z.array(ManifestEntrySchema).parse(raw);
}
```

- [ ] **Step 5: Run to verify it passes** — `npm test -- manifest` → PASS.
- [ ] **Step 6: Commit**

```bash
git add eval/fairness/types.ts eval/fairness/manifest.ts eval/fairness/__tests__/manifest.test.ts package.json package-lock.json
git commit -m "feat(eval): observation type + zod manifest schema (FST + consentRef required)"
```

---

## Task 3: Gate-parity metric

**Files:** Create `eval/fairness/gate-parity.ts`; Test `eval/fairness/__tests__/gate-parity.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// eval/fairness/__tests__/gate-parity.test.ts
import { gateParity } from '../gate-parity';
import type { Observation } from '../types';
import type { Fitzpatrick } from '../fst';

const emptyScores = {} as Observation['scores'];
function obs(fst: Fitzpatrick, allPass: boolean): Observation {
  return { fst, subjectId: `${fst}-${Math.random()}`, scores: emptyScores,
    gate: { face: true, lighting: true, focus: true, distance: true, allPass, hint: '' } };
}

test('computes per-FST pass rate and the best-worst gap above min samples', () => {
  const data = [
    ...Array.from({ length: 2 }, () => obs('I', true)),                    // I: 100%
    obs('VI', true), obs('VI', false), obs('VI', false), obs('VI', false), // VI: 25%
  ];
  const r = gateParity(data, 2);
  expect(r.perFst.I.rate).toBe(1);
  expect(r.perFst.VI.rate).toBe(0.25);
  expect(r.gap).toBeCloseTo(0.75, 5);
});
test('groups below min samples report a null rate (insufficient sample)', () => {
  const r = gateParity([obs('III', true)], 5);
  expect(r.perFst.III.rate).toBeNull();
  expect(r.perFst.III.total).toBe(1);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- gate-parity` → FAIL.

- [ ] **Step 3: Implement**

```typescript
// eval/fairness/gate-parity.ts
import { FITZPATRICK, type Fitzpatrick } from './fst';
import type { Observation } from './types';

export interface GroupRate { pass: number; total: number; rate: number | null }
export interface GateParity {
  perFst: Record<Fitzpatrick, GroupRate>;
  bestRate: number | null;
  worstRate: number | null;
  gap: number | null;
}

export function gateParity(obs: Observation[], minSamples: number): GateParity {
  const perFst = {} as Record<Fitzpatrick, GroupRate>;
  for (const f of FITZPATRICK) {
    const group = obs.filter((o) => o.fst === f);
    const total = group.length;
    const pass = group.filter((o) => o.gate.allPass).length;
    perFst[f] = { pass, total, rate: total >= minSamples ? pass / total : null };
  }
  const rates = FITZPATRICK.map((f) => perFst[f].rate).filter((r): r is number => r !== null);
  const bestRate = rates.length ? Math.max(...rates) : null;
  const worstRate = rates.length ? Math.min(...rates) : null;
  const gap = bestRate !== null && worstRate !== null ? bestRate - worstRate : null;
  return { perFst, bestRate, worstRate, gap };
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- gate-parity` → PASS.
- [ ] **Step 5: Commit**

```bash
git add eval/fairness/gate-parity.ts eval/fairness/__tests__/gate-parity.test.ts
git commit -m "feat(eval): quality-gate pass-rate parity across Fitzpatrick groups"
```

---

## Task 4: Stability metric

**Files:** Create `eval/fairness/stability.ts`; Test `eval/fairness/__tests__/stability.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// eval/fairness/__tests__/stability.test.ts
import { stability } from '../stability';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';
import type { Observation } from '../types';
import type { Fitzpatrick } from '../fst';
import type { ScoreVector } from '../../../src/features/read/read-types';

const gate = { face: true, lighting: true, focus: true, distance: true, allPass: true, hint: '' };
function scores(v: number): ScoreVector {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, v])) as ScoreVector;
}
function obs(fst: Fitzpatrick, subjectId: string, v: number): Observation {
  return { fst, subjectId, gate, scores: scores(v) };
}

test('a subject with identical repeat scores has zero instability', () => {
  const data = [obs('II', 's1', 0.5), obs('II', 's1', 0.5)];
  const r = stability(data, 1);
  expect(r.perFst.II).toBe(0);
});
test('more variation across a subject\'s repeats means higher instability', () => {
  const data = [obs('V', 's1', 0.2), obs('V', 's1', 0.8)];
  const r = stability(data, 1);
  expect(r.perFst.V).toBeGreaterThan(0);
});
test('a group with too few multi-capture subjects reports null', () => {
  const r = stability([obs('I', 's1', 0.5), obs('I', 's1', 0.5)], 2);
  expect(r.perFst.I).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- stability` → FAIL.

- [ ] **Step 3: Implement**

```typescript
// eval/fairness/stability.ts
import { FITZPATRICK, type Fitzpatrick } from './fst';
import { DIMENSIONS } from '../../src/content/cosmetic-vocab';
import type { Observation } from './types';

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// One subject's instability = mean over dimensions of the std of that subject's repeat scores.
function subjectInstability(group: Observation[]): number {
  const perDim = DIMENSIONS.map((d) => std(group.map((o) => o.scores[d])));
  return perDim.reduce((a, b) => a + b, 0) / perDim.length;
}

export interface StabilityResult {
  perFst: Record<Fitzpatrick, number | null>; // mean subject instability; null if insufficient
  best: number | null; // lowest instability = best
  worst: number | null;
  gap: number | null;
}

export function stability(obs: Observation[], minSubjects: number): StabilityResult {
  const perFst = {} as Record<Fitzpatrick, number | null>;
  for (const f of FITZPATRICK) {
    const bySubject = new Map<string, Observation[]>();
    for (const o of obs.filter((x) => x.fst === f)) {
      bySubject.set(o.subjectId, [...(bySubject.get(o.subjectId) ?? []), o]);
    }
    const subjects = [...bySubject.values()].filter((s) => s.length >= 2); // need repeats
    perFst[f] = subjects.length >= minSubjects
      ? subjects.map(subjectInstability).reduce((a, b) => a + b, 0) / subjects.length
      : null;
  }
  const vals = FITZPATRICK.map((f) => perFst[f]).filter((v): v is number => v !== null);
  const best = vals.length ? Math.min(...vals) : null;
  const worst = vals.length ? Math.max(...vals) : null;
  const gap = best !== null && worst !== null ? worst - best : null;
  return { perFst, best, worst, gap };
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- stability` → PASS.
- [ ] **Step 5: Commit**

```bash
git add eval/fairness/stability.ts eval/fairness/__tests__/stability.test.ts
git commit -m "feat(eval): intra-subject score stability parity across Fitzpatrick groups"
```

---

## Task 5: Systematic-bias metric

**Files:** Create `eval/fairness/bias.ts`; Test `eval/fairness/__tests__/bias.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// eval/fairness/__tests__/bias.test.ts
import { bias } from '../bias';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';
import type { Observation } from '../types';
import type { Fitzpatrick } from '../fst';
import type { ScoreVector } from '../../../src/features/read/read-types';

const gate = { face: true, lighting: true, focus: true, distance: true, allPass: true, hint: '' };
function ob(fst: Fitzpatrick, darkSpots: number): Observation {
  const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ScoreVector;
  scores.darkSpots = darkSpots;
  return { fst, subjectId: `${fst}`, gate, scores };
}

test('flags a dimension whose score tracks Fitzpatrick index (systematic bias)', () => {
  // darkSpots rises monotonically with FST -> strong positive correlation
  const data: Observation[] = [
    ob('I', 0.1), ob('II', 0.2), ob('III', 0.3), ob('IV', 0.6), ob('V', 0.8), ob('VI', 0.95),
  ];
  const r = bias(data, 0.2);
  expect(r.flagged).toContain('darkSpots');
  expect(Math.abs(r.perDimension.darkSpots)).toBeGreaterThan(0.2);
});
test('does not flag a tone-independent dimension', () => {
  const data: Observation[] = [ob('I', 0.5), ob('VI', 0.5)];
  const r = bias(data, 0.2);
  expect(r.flagged).not.toContain('hydration'); // constant 0.5 -> corr 0
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- bias` → FAIL.

- [ ] **Step 3: Implement**

```typescript
// eval/fairness/bias.ts
import { DIMENSIONS, type Dimension } from '../../src/content/cosmetic-vocab';
import { fstIndex } from './fst';
import type { Observation } from './types';

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export interface BiasResult {
  perDimension: Record<Dimension, number>; // corr(FST index, score)
  flagged: Dimension[]; // |corr| > bound
}

export function bias(obs: Observation[], bound: number): BiasResult {
  const x = obs.map((o) => fstIndex(o.fst));
  const perDimension = {} as Record<Dimension, number>;
  const flagged: Dimension[] = [];
  for (const d of DIMENSIONS) {
    const c = pearson(x, obs.map((o) => o.scores[d]));
    perDimension[d] = c;
    if (Math.abs(c) > bound) flagged.push(d);
  }
  return { perDimension, flagged };
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- bias` → PASS.
- [ ] **Step 5: Commit**

```bash
git add eval/fairness/bias.ts eval/fairness/__tests__/bias.test.ts
git commit -m "feat(eval): systematic-bias check (corr of Fitzpatrick vs score per dimension)"
```

---

## Task 6: Provisional thresholds + combined FairnessReport

**Files:** Create `eval/fairness/thresholds.ts`, `eval/fairness/metrics.ts`; Test `eval/fairness/__tests__/metrics.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// eval/fairness/__tests__/metrics.test.ts
import { fairnessReport } from '../metrics';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';
import type { Observation } from '../types';
import type { Fitzpatrick } from '../fst';
import type { ScoreVector } from '../../../src/features/read/read-types';

function scores(v: number): ScoreVector {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, v])) as ScoreVector;
}
function obs(fst: Fitzpatrick, subjectId: string, allPass: boolean, v: number): Observation {
  return { fst, subjectId, scores: scores(v),
    gate: { face: true, lighting: true, focus: true, distance: true, allPass, hint: '' } };
}
// loose thresholds so a tiny synthetic set can exercise pass/fail deterministically
const t = { minSamplesPerFst: 1, minSubjectsPerFst: 1, gateFloor: 0.9, gateMaxGap: 0.05,
  stabilityTolerance: 0.25, biasBound: 0.2 } as const;

test('a balanced set passes every axis', () => {
  const data = ['I', 'II', 'III', 'IV', 'V', 'VI'].flatMap((f) =>
    [obs(f as Fitzpatrick, `${f}-a`, true, 0.5), obs(f as Fitzpatrick, `${f}-a`, true, 0.5)]);
  const r = fairnessReport(data, '2026-06-17T00:00:00Z', t);
  expect(r.gate.pass).toBe(true);
  expect(r.bias.pass).toBe(true);
  expect(r.pass).toBe(true);
});
test('a gate disparity fails the gate axis and overall', () => {
  const data = [
    obs('I', 'I-a', true, 0.5), obs('I', 'I-a', true, 0.5),
    obs('VI', 'VI-a', false, 0.5), obs('VI', 'VI-a', false, 0.5), // VI never passes the gate
  ];
  const r = fairnessReport(data, '2026-06-17T00:00:00Z', t);
  expect(r.gate.pass).toBe(false);
  expect(r.pass).toBe(false);
});
test('overall is null (insufficient) when a group lacks samples', () => {
  const r = fairnessReport([obs('I', 'I-a', true, 0.5)], '2026-06-17T00:00:00Z',
    { ...t, minSamplesPerFst: 50 });
  expect(r.gate.pass).toBeNull();
  expect(r.pass).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- metrics` → FAIL.

- [ ] **Step 3: Implement thresholds**

```typescript
// eval/fairness/thresholds.ts
// PROVISIONAL acceptance thresholds — owned by founders + counsel + a domain expert, NOT final.
// The harness reports numbers against these; the real pass/fail policy is set with validation data.
export const THRESHOLDS = {
  minSamplesPerFst: 30, // below this, a group's gate rate is "insufficient sample"
  minSubjectsPerFst: 10, // stability needs this many multi-capture subjects per group
  gateFloor: 0.9, // every FST group's gate pass-rate must be >= this
  gateMaxGap: 0.05, // best-worst gate pass-rate gap must be <= this
  stabilityTolerance: 0.25, // worst-group instability <= best-group * (1 + this)
  biasBound: 0.2, // |corr(FST, score)| above this is flagged
} as const;
export type Thresholds = typeof THRESHOLDS;
```

- [ ] **Step 4: Implement metrics**

```typescript
// eval/fairness/metrics.ts
import { gateParity, type GateParity } from './gate-parity';
import { stability, type StabilityResult } from './stability';
import { bias, type BiasResult } from './bias';
import { THRESHOLDS, type Thresholds } from './thresholds';
import type { Observation } from './types';

export interface FairnessReport {
  generatedAt: string;
  totalObservations: number;
  gate: GateParity & { pass: boolean | null };
  stability: StabilityResult & { pass: boolean | null };
  bias: BiasResult & { pass: boolean };
  pass: boolean | null; // overall; null when an axis is insufficient-sample
}

export function fairnessReport(
  obs: Observation[],
  generatedAt: string,
  t: Thresholds = THRESHOLDS,
): FairnessReport {
  const g = gateParity(obs, t.minSamplesPerFst);
  const gatePass = g.bestRate === null || g.worstRate === null
    ? null
    : g.worstRate >= t.gateFloor && (g.gap ?? 0) <= t.gateMaxGap;

  const s = stability(obs, t.minSubjectsPerFst);
  const stabilityPass = s.best === null || s.worst === null
    ? null
    : s.worst <= s.best * (1 + t.stabilityTolerance);

  const b = bias(obs, t.biasBound);
  const biasPass = b.flagged.length === 0;

  const pass = gatePass === null || stabilityPass === null
    ? null
    : gatePass && stabilityPass && biasPass;

  return {
    generatedAt,
    totalObservations: obs.length,
    gate: { ...g, pass: gatePass },
    stability: { ...s, pass: stabilityPass },
    bias: { ...b, pass: biasPass },
    pass,
  };
}
```

- [ ] **Step 5: Run to verify it passes** — `npm test -- metrics` → PASS.
- [ ] **Step 6: Commit**

```bash
git add eval/fairness/thresholds.ts eval/fairness/metrics.ts eval/fairness/__tests__/metrics.test.ts
git commit -m "feat(eval): provisional thresholds + combined FairnessReport (gate/stability/bias)"
```

---

## Task 7: Runner (manifest + injected extractor → observations)

**Files:** Create `eval/fairness/run-eval.ts`; Test `eval/fairness/__tests__/run-eval.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// eval/fairness/__tests__/run-eval.test.ts
import { runEval, type Extractor } from '../run-eval';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';
import type { ManifestEntry } from '../manifest';
import type { ScoreVector } from '../../../src/features/read/read-types';

const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ScoreVector;
const entry = (id: string): ManifestEntry => ({
  imageRef: `${id}.jpg`, fst: 'III', subjectId: id, lighting: 'x',
  source: 'fixture', consentRef: 'c1', fstProvenance: 'annotated',
});
const extract: Extractor = async () => ({
  gate: { face: true, lighting: true, focus: true, distance: true, allPass: true, hint: '' },
  scores,
});

test('produces one observation per manifest entry, carrying FST + subjectId', async () => {
  const obs = await runEval([entry('a'), entry('b')], extract);
  expect(obs).toHaveLength(2);
  expect(obs[0].fst).toBe('III');
  expect(obs[0].subjectId).toBe('a');
  expect(obs[1].gate.allPass).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- run-eval` → FAIL.

- [ ] **Step 3: Implement**

```typescript
// eval/fairness/run-eval.ts
import type { ManifestEntry } from './manifest';
import type { Observation } from './types';
import type { QualityReport } from '../../src/features/capture/quality-gate';
import type { ScoreVector } from '../../src/features/read/read-types';

// Turns one manifest entry into a gate report + scores. Fixture-fed today; the REAL extractor
// (gated on the model + counsel-approved images) decodes the image and runs the on-device read here.
export type Extractor = (entry: ManifestEntry) => Promise<{ gate: QualityReport; scores: ScoreVector }>;

export async function runEval(manifest: ManifestEntry[], extract: Extractor): Promise<Observation[]> {
  const out: Observation[] = [];
  for (const entry of manifest) {
    const { gate, scores } = await extract(entry);
    out.push({ fst: entry.fst, subjectId: entry.subjectId, gate, scores });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- run-eval` → PASS.
- [ ] **Step 5: Commit**

```bash
git add eval/fairness/run-eval.ts eval/fairness/__tests__/run-eval.test.ts
git commit -m "feat(eval): runner mapping manifest + injected extractor to observations"
```

---

## Task 8: Report renderer (aggregate only)

**Files:** Create `eval/fairness/report.ts`; Test `eval/fairness/__tests__/report.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// eval/fairness/__tests__/report.test.ts
import { renderReportMarkdown, renderReportJson } from '../report';
import { fairnessReport } from '../metrics';
import { DIMENSIONS } from '../../../src/content/cosmetic-vocab';
import type { Observation } from '../types';
import type { Fitzpatrick } from '../fst';
import type { ScoreVector } from '../../../src/features/read/read-types';

function scores(v: number): ScoreVector {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, v])) as ScoreVector;
}
function obs(fst: Fitzpatrick, subjectId: string): Observation {
  return { fst, subjectId, scores: scores(0.5),
    gate: { face: true, lighting: true, focus: true, distance: true, allPass: true, hint: '' } };
}

const report = fairnessReport(
  ['I', 'II', 'III', 'IV', 'V', 'VI'].flatMap((f) =>
    [obs(f as Fitzpatrick, `${f}-a`), obs(f as Fitzpatrick, `${f}-a`)]),
  '2026-06-17T00:00:00Z',
  { minSamplesPerFst: 1, minSubjectsPerFst: 1, gateFloor: 0.9, gateMaxGap: 0.05,
    stabilityTolerance: 0.25, biasBound: 0.2 },
);

test('markdown shows the date, every FST group, and the overall verdict', () => {
  const md = renderReportMarkdown(report);
  expect(md).toContain('2026-06-17T00:00:00Z');
  expect(md).toContain('FST VI');
  expect(md).toMatch(/Overall: (PASS|FAIL|INSUFFICIENT SAMPLE)/);
});
test('the report carries no per-subject identifiers (aggregate only)', () => {
  const json = renderReportJson(report);
  expect(json).not.toContain('subjectId');
  expect(json).not.toContain('-a'); // the synthetic subject ids never appear
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- report` → FAIL.

- [ ] **Step 3: Implement**

```typescript
// eval/fairness/report.ts
import type { FairnessReport } from './metrics';
import { FITZPATRICK } from './fst';

// FairnessReport is aggregate by construction (no per-subject rows), so JSON is safe to commit.
export function renderReportJson(r: FairnessReport): string {
  return JSON.stringify(r, null, 2);
}

function verdict(p: boolean | null): string {
  return p === null ? 'INSUFFICIENT SAMPLE' : p ? 'PASS' : 'FAIL';
}

export function renderReportMarkdown(r: FairnessReport): string {
  const lines: string[] = [
    `# Fairness eval — ${r.generatedAt}`,
    '',
    `Observations: ${r.totalObservations} · Overall: ${verdict(r.pass)}`,
    '',
    '## Quality-gate parity',
  ];
  for (const f of FITZPATRICK) {
    const g = r.gate.perFst[f];
    lines.push(`- FST ${f}: ${g.rate === null ? 'insufficient sample' : `${(g.rate * 100).toFixed(1)}% (${g.pass}/${g.total})`}`);
  }
  lines.push(`- gap: ${r.gate.gap === null ? 'n/a' : `${(r.gate.gap * 100).toFixed(1)} pp`} · axis: ${verdict(r.gate.pass)}`);
  lines.push('', '## Score stability (lower = better)');
  for (const f of FITZPATRICK) {
    const v = r.stability.perFst[f];
    lines.push(`- FST ${f}: ${v === null ? 'insufficient sample' : v.toFixed(4)}`);
  }
  lines.push(`- axis: ${verdict(r.stability.pass)}`);
  lines.push('', '## Systematic bias (|corr(FST, score)|)');
  lines.push(`- flagged dimensions: ${r.bias.flagged.length ? r.bias.flagged.join(', ') : 'none'} · axis: ${r.bias.pass ? 'PASS' : 'FAIL'}`);
  return lines.join('\n');
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- report` → PASS.
- [ ] **Step 5: Commit**

```bash
git add eval/fairness/report.ts eval/fairness/__tests__/report.test.ts
git commit -m "feat(eval): aggregate-only fairness report renderer (md + json)"
```

---

## Task 9: Synthetic fixtures + end-to-end smoke

**Files:** Create `eval/fairness/run-fixtures.ts`; Test `eval/fairness/__tests__/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// eval/fairness/__tests__/smoke.test.ts
import { buildSyntheticObservations } from '../run-fixtures';
import { fairnessReport } from '../metrics';
import { renderReportMarkdown } from '../report';

test('end-to-end on synthetic data produces a complete report', () => {
  const obs = buildSyntheticObservations();
  const report = fairnessReport(obs, '2026-06-17T00:00:00Z',
    { minSamplesPerFst: 1, minSubjectsPerFst: 1, gateFloor: 0.9, gateMaxGap: 0.05,
      stabilityTolerance: 0.25, biasBound: 0.2 });
  expect(report.totalObservations).toBeGreaterThan(0);
  expect(renderReportMarkdown(report)).toContain('Overall:');
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- smoke` → FAIL.

- [ ] **Step 3: Implement the synthetic fixture builder**

```typescript
// eval/fairness/run-fixtures.ts
// Deterministic synthetic observations so the whole pipeline runs in CI with NO real faces.
// Two balanced captures per subject, one subject per FST group, all gates pass, constant scores.
import { FITZPATRICK } from './fst';
import { DIMENSIONS } from '../../src/content/cosmetic-vocab';
import type { Observation } from './types';
import type { ScoreVector } from '../../src/features/read/read-types';

function scores(v: number): ScoreVector {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, v])) as ScoreVector;
}

export function buildSyntheticObservations(): Observation[] {
  const gate = { face: true, lighting: true, focus: true, distance: true, allPass: true, hint: '' };
  return FITZPATRICK.flatMap((fst) => [
    { fst, subjectId: `${fst}-1`, gate, scores: scores(0.5) },
    { fst, subjectId: `${fst}-1`, gate, scores: scores(0.5) },
  ]);
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- smoke` → PASS.

> Note: the smoke test IS the end-to-end proof on synthetic data (no real faces, no fs writes). A real
> run over `eval/data/` is a future task, gated on the model + counsel-approved images — it supplies the
> real `Extractor` to `runEval`. We deliberately do NOT add a standalone CLI/demo script now: the repo
> has no TS runner (no `ts-node`/`tsx`), and a real run is gated anyway, so a script would be dead code.

- [ ] **Step 5: Commit**

```bash
git add eval/fairness/run-fixtures.ts eval/fairness/__tests__/smoke.test.ts
git commit -m "feat(eval): synthetic fixtures + end-to-end smoke"
```

---

## Task 10: Data-dir hygiene + guard

**Files:** Modify `.gitignore`; Create `eval/data/README.md`, `eval/reports/.gitkeep`, `eval/__tests__/hygiene.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// eval/__tests__/hygiene.test.ts
import { execSync } from 'node:child_process';

test('no image files are tracked under eval/ (raw faces never enter git)', () => {
  const tracked = execSync('git ls-files eval', { encoding: 'utf8' });
  const images = tracked.split('\n').filter((f) => /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(f));
  expect(images).toEqual([]);
});

test('eval/data is gitignored', () => {
  const out = execSync('git check-ignore eval/data/sample.jpg || true', { encoding: 'utf8' });
  expect(out).toContain('eval/data/sample.jpg');
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- hygiene`
Expected: FAIL — `eval/data` not yet ignored (second test fails).

- [ ] **Step 3: Implement**

Append to `.gitignore`:
```
# Fairness eval: raw images + manifests with real faces NEVER enter git
eval/data/
```

Create `eval/data/README.md`:
```markdown
# eval/data — LOCAL ONLY (gitignored)

Real face images and their manifest live here. **They are never committed to git and never uploaded
to production Supabase** (TrueTone compliance boundary; BIPA/PIPA).

## Layout
- `manifest.json` — array matching `eval/fairness/manifest.ts` (`imageRef`, `fst`, `subjectId`,
  `lighting`, `source`, `consentRef`, `fstProvenance`).
- image files referenced by `imageRef`.

## Hard rules (see docs/superpowers/specs/2026-06-16-truetone-fairness-eval-design.md §9)
- The specific dataset/source, its license, and subject consent require **founder + counsel sign-off**
  before any real image is placed here.
- Every manifest entry MUST carry a `consentRef`.
- Only aggregate reports (`eval/reports/`) are committed — never images or per-subject data.
```

Create `eval/reports/.gitkeep` (empty file).

- [ ] **Step 4: Run to verify it passes** — `npm test -- hygiene` → PASS (no images tracked; `eval/data` ignored).
- [ ] **Step 5: Commit**

```bash
git add .gitignore eval/data/README.md eval/reports/.gitkeep eval/__tests__/hygiene.test.ts
git commit -m "chore(eval): gitignore eval/data, document rules, guard against tracked images"
```

---

## Task 11: Full-suite gate + spec deviation note

**Files:** (verification); Modify the spec or this plan if anything deviated.

- [ ] **Step 1: Run the full unit suite + tsc**

Run: `npm test`
Expected: all suites pass, including the new `eval/**` suites (they are not in `testPathIgnorePatterns`; they do not affect the coverage gate, which is scoped to `src`/`app`).

Run: `npx tsc --noEmit --pretty false`
Expected: 0 errors.

- [ ] **Step 2: Confirm the end-to-end smoke**

Run: `npm test -- smoke`
Expected: PASS — the pipeline (synthetic observations → `fairnessReport` → `renderReportMarkdown`) produces a complete report.

- [ ] **Step 3: Record any deviations**

If the executor changed anything from this plan (e.g. zod already present so the install was a no-op,
or a metric formula adjusted), append a short "Deviations" note to this plan file.

- [ ] **Step 4: Commit (if anything changed)**

```bash
git add -A
git commit -m "docs(eval): record fairness-eval implementation deviations"
```

---

## Definition of done

- [ ] FST schema + zod manifest (FST + consentRef required) implemented and tested.
- [ ] Three pure metric axes (gate parity, stability, bias) + combined `FairnessReport`, all unit-tested incl. min-sample handling.
- [ ] Runner takes an injected extractor; real image→read extractor explicitly deferred (gated).
- [ ] Aggregate-only report renderer; test asserts no per-subject data leaks into the report.
- [ ] `eval/data/` gitignored; guard test proves no images tracked under `eval/`.
- [ ] Synthetic fixtures + end-to-end smoke + demo script run with no real faces.
- [ ] `npm test` green; `tsc --noEmit` clean.
- [ ] Thresholds documented as provisional/policy-owned; no equity claim is made anywhere.
- [ ] Spec §9 hard gates intact: no real images sourced/committed; sourcing remains a counsel sign-off.

---

## Deviations

Recorded after Tasks 1-9 implementation + review cycle (all committed before Task 10).

### `thresholds.ts` — `Thresholds` type widened (commit `4e40ba6`)

Plan specified `export type Thresholds = typeof THRESHOLDS;`, which resolves to a type with literal
number values (e.g. `gateFloor: 0.9` rather than `gateFloor: number`). Test fixtures pass override
objects with different numeric values, which TypeScript rejected as not assignable to the literal
type. Fix: replaced `typeof THRESHOLDS` with an explicit interface using `number` fields.

### `metrics.ts` — fail-closed combiner with asymmetric per-axis verdicts (commit `20f1f05`)

The plan's combiner treated any null axis as `null` overall and any false axis as `false` overall,
but had a gap: an axis that was neither definitively null nor definitively false (e.g. one group has
insufficient sample but another group definitively fails) could produce a misleading null rather
than FAIL. The implementation was hardened to be fail-closed: a definite FAIL on any axis
disqualifies the run regardless of other axes being null; a flagged bias dimension always yields
FAIL; a partial FST coverage (criterion-met-but-incomplete axis) returns null rather than false
pass. A dead `?? 0` gap fallback was also removed.

### `manifest.ts` — whitespace-only `consentRef` rejected (commit `20f1f05`)

Plan's `consentRef: z.string().min(1)` would accept a string of spaces. Changed to
`.trim().min(1)` so whitespace-only values are also rejected. Same treatment applied to other
string fields.

### `gate-parity.ts` — `GroupRate.pass` renamed to `passCount` (commit `20f1f05`)

The plan's `GroupRate` interface had a field named `pass` (the count of gate-passing observations).
This collided with the boolean `pass` field added by `FairnessReport` via the spread `{ ...g, pass: gatePass }`,
causing a type conflict. Renamed the count field to `passCount`.

### `stability.ts` — population std (÷n) documented; misleading param renamed (commit `20f1f05`)

The plan did not specify population vs sample std. The implementation uses population std (÷n), which
is appropriate here (the group of observations is the whole population being measured, not a sample
of a larger population). This choice is now documented in a comment. A misleading internal parameter
name was also renamed for clarity.

### Task 9 — no standalone CLI/demo script added (by design)

The plan note at the end of Task 9 explicitly states that no standalone CLI/demo script is added
because the repo has no TypeScript runner (`ts-node`/`tsx`) and a real run is gated on the model
and counsel-approved images. The smoke test (`eval/fairness/__tests__/smoke.test.ts`) is the
end-to-end proof on synthetic data. This remains the case — no CLI was added.

### Task 10 — `eval/data/README.md` not committed (by construction)

The plan's Task 10 commit includes `eval/data/README.md`, but once `eval/data/` is added to
`.gitignore`, git refuses to stage any file inside it. The README was created locally for engineers
who populate the directory, but it is correctly excluded from git. This is the compliance boundary
working as designed. The hygiene guard (`eval/__tests__/hygiene.test.ts`) continues to pass because
git tracks no files inside `eval/data/`.

### Final suite totals (Task 11, 2026-06-17)

- `npm test`: **34 suites / 104 tests — all pass**
- `npx tsc --noEmit --pretty false`: **0 errors**
- `npm test -- smoke`: **2 suites / 2 tests — all pass**
