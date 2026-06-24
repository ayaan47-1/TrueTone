# Skin Appearance Age + Trend (premium) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a premium skin-age feature in two halves — a within-user **freshness trend** that ships now (derived from cosmetic scores we already store) and an absolute **skin-appearance-age** estimate that is built on-device but stays dark behind a flag until validation data is on file.

**Architecture:** A pure `skin-age-trend` module computes a relative freshness direction from the user's historical score vectors — no population claim, no validation gate, ships on. A separate on-device `skin-age-engine` produces an absolute age estimate alongside the read (before image deletion), gated by `SKIN_AGE_ABSOLUTE_ENABLED = false`; its output (null while dark) is persisted as two new nullable columns on the existing `scans` row via the `record_scan` RPC. A thin `premium-entitlement` abstraction (local stub now; real RevenueCat wiring is a separate gated task) gates display only — it never sees scores or the image.

**Tech Stack:** Expo SDK 56 + React Native + TypeScript, Supabase (Postgres RPC + RLS + migrations), Jest (jest-expo) + @testing-library/react-native, NativeWind.

## Global Constraints

- **Cosmetic line:** all age/trend copy describes how skin *looks*; never a health/biological/aging-rate claim. Every user-facing string MUST pass `findDiseaseTerms(text).length === 0` (`src/lib/cosmetic-filter.ts`).
- **Absolute-number gate:** `SKIN_AGE_ABSOLUTE_ENABLED` MUST default to `false`. The absolute number stays invisible and unpersisted (null) until validation data is on file AND a founder/legal sign-off flips it. Flipping it is NOT an engineering-only decision.
- **Compliance boundary:** age is computed on-device, before image deletion; only the derived number crosses to the backend. The raw image never leaves the device. Billing (`premium-entitlement`) receives no scores and no image — only an entitlement boolean.
- **No new vendor in this plan:** do NOT add `react-native-purchases` / RevenueCat native SDK. Task 9 stubs entitlement; real RevenueCat wiring is deferred to Task 10 (escalation-gated).
- **Data-rights inheritance:** new columns live on `public.scans`, so they inherit RLS (`user_id = auth.uid()`), `delete_my_data()`, the consent-withdrawn purge, and the 3-year `truetone_retention_sweep()` — verify, add nothing new.
- **Migrations:** additive only; next file is `supabase/migrations/0011_skin_age.sql`. Writes go through the `record_scan` SECURITY DEFINER RPC — clients have no insert/update policy.
- **Versions:** `@react-native-async-storage/async-storage` stays pinned at `2.2.0` (SDK-56 native). Do not bump.
- **Coverage:** jest thresholds are 80% lines/statements/functions, 70% branches. Pure modules (trend, engine transform, copy, entitlement) must be fully covered; native/UI-only files may be added to `coveragePathIgnorePatterns` following the existing `Capture.tsx` precedent.
- **Target repo:** implement on `main` (the source of truth) on a fresh feature branch. The `stub-read` worktree is redundant; these spec/plan docs travel to `main` via the PR.

---

### Task 1: Age types + feature flag

**Files:**
- Create: `src/features/age/age-types.ts`
- Create: `src/features/age/age-flags.ts`
- Test: `src/features/age/__tests__/age-flags.test.ts`

**Interfaces:**
- Consumes: `ScoreVector` from `src/features/read/read-types.ts`.
- Produces:
  - `SKIN_AGE_ABSOLUTE_ENABLED: boolean` (const, `false`).
  - `type ScoreSnapshot = { capturedAt: string; scores: ScoreVector }`
  - `type TrendDirection = 'fresher' | 'steady' | 'more-tired'`
  - `interface SkinAgeTrend { direction: TrendDirection; delta: number; sampleCount: number }`
  - `interface SkinAgeEstimate { ageEstimate: number; confidence: number; modelVersion: string }`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/age/__tests__/age-flags.test.ts
import { SKIN_AGE_ABSOLUTE_ENABLED } from '../age-flags';

describe('age feature flags', () => {
  it('keeps the absolute skin-age number dark by default (validation gate)', () => {
    expect(SKIN_AGE_ABSOLUTE_ENABLED).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/age/__tests__/age-flags.test.ts`
Expected: FAIL — `Cannot find module '../age-flags'`.

- [ ] **Step 3: Write the flag + types**

```typescript
// src/features/age/age-flags.ts
// The absolute "your skin looks like ~N" number is an accuracy claim. Per CLAUDE.md §1 it MUST NOT
// ship without validation data on file. This flag stays false until that data exists AND a
// founder/legal sign-off flips it. Flipping it is not an engineering-only decision.
export const SKIN_AGE_ABSOLUTE_ENABLED = false;
```

```typescript
// src/features/age/age-types.ts
import type { ScoreVector } from '../read/read-types';

// One scan's cosmetic scores plus when it was taken. Input to the freshness trend.
export type ScoreSnapshot = { capturedAt: string; scores: ScoreVector };

// Relative, within-user direction. Carries no population claim, so it ships without the age gate.
export type TrendDirection = 'fresher' | 'steady' | 'more-tired';

export interface SkinAgeTrend {
  direction: TrendDirection;
  delta: number; // signed, normalized aggregate change of the freshness index (latest vs baseline)
  sampleCount: number; // number of scans compared (>= 2 for a real trend)
}

// Absolute appearance-age estimate. Produced on-device; stays dark until SKIN_AGE_ABSOLUTE_ENABLED.
export interface SkinAgeEstimate {
  ageEstimate: number; // whole years, cosmetic "looks like" only
  confidence: number; // 0..1
  modelVersion: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/age/__tests__/age-flags.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/age/age-flags.ts src/features/age/age-types.ts src/features/age/__tests__/age-flags.test.ts
git commit -m "feat(age): add age feature flag (dark by default) and shared types"
```

---

### Task 2: Skin freshness trend (pure, ships on)

**Files:**
- Create: `src/features/age/skin-age-trend.ts`
- Test: `src/features/age/__tests__/skin-age-trend.test.ts`

**Interfaces:**
- Consumes: `ScoreSnapshot`, `SkinAgeTrend`, `TrendDirection` (Task 1); `DIMENSIONS`, `Dimension` from `src/content/cosmetic-vocab.ts`.
- Produces: `computeSkinFreshnessTrend(history: ScoreSnapshot[]): SkinAgeTrend` and `FRESHNESS_POLARITY: Record<Dimension, 1 | -1 | 0>`.

**Design note:** Freshness index per scan = mean over dimensions of `polarity === 1 ? score : polarity === -1 ? 1 - score : skip`. Higher = fresher-looking. Trend compares the latest scan's index against the mean of the earlier scans (baseline). `delta = latestIndex - baselineIndex`. Direction: `delta > 0.02 → 'fresher'`, `delta < -0.02 → 'more-tired'`, else `'steady'`. Fewer than 2 scans → `steady`, delta 0.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/age/__tests__/skin-age-trend.test.ts
import { computeSkinFreshnessTrend, FRESHNESS_POLARITY } from '../skin-age-trend';
import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ScoreVector } from '../../read/read-types';

function vec(fill: number): ScoreVector {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, fill])) as ScoreVector;
}

describe('computeSkinFreshnessTrend', () => {
  it('every dimension has a defined polarity', () => {
    for (const d of DIMENSIONS) expect(FRESHNESS_POLARITY[d]).toBeDefined();
  });

  it('returns steady with no real trend when given fewer than 2 scans', () => {
    expect(computeSkinFreshnessTrend([])).toEqual({ direction: 'steady', delta: 0, sampleCount: 0 });
    const one = computeSkinFreshnessTrend([{ capturedAt: '2026-06-01', scores: vec(0.5) }]);
    expect(one).toEqual({ direction: 'steady', delta: 0, sampleCount: 1 });
  });

  it('reads as fresher when appearance scores drop and hydration rises', () => {
    // baseline: low hydration, high blemish-appearance; latest: improved on both axes.
    const baseline: ScoreVector = { ...vec(0.6), hydration: 0.3 };
    const latest: ScoreVector = { ...vec(0.2), hydration: 0.9 };
    const t = computeSkinFreshnessTrend([
      { capturedAt: '2026-06-10', scores: latest },
      { capturedAt: '2026-06-01', scores: baseline },
    ]);
    expect(t.direction).toBe('fresher');
    expect(t.delta).toBeGreaterThan(0);
    expect(t.sampleCount).toBe(2);
  });

  it('reads as more-tired when appearance worsens', () => {
    const baseline: ScoreVector = { ...vec(0.2), hydration: 0.9 };
    const latest: ScoreVector = { ...vec(0.7), hydration: 0.3 };
    const t = computeSkinFreshnessTrend([
      { capturedAt: '2026-06-10', scores: latest },
      { capturedAt: '2026-06-01', scores: baseline },
    ]);
    expect(t.direction).toBe('more-tired');
    expect(t.delta).toBeLessThan(0);
  });

  it('reads as steady for negligible change', () => {
    const t = computeSkinFreshnessTrend([
      { capturedAt: '2026-06-10', scores: vec(0.5) },
      { capturedAt: '2026-06-01', scores: vec(0.5) },
    ]);
    expect(t.direction).toBe('steady');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/age/__tests__/skin-age-trend.test.ts`
Expected: FAIL — `Cannot find module '../skin-age-trend'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/features/age/skin-age-trend.ts
import { DIMENSIONS, type Dimension } from '../../content/cosmetic-vocab';
import type { ScoreVector } from '../read/read-types';
import type { ScoreSnapshot, SkinAgeTrend, TrendDirection } from './age-types';

// Polarity of each cosmetic dimension for a relative "freshness" read:
//  1  → higher score looks fresher (hydration)
// -1  → lower score looks fresher (visible texture/pores/spots/redness/lines/circles)
//  0  → neutral, excluded from the index (oiliness is not a freshness signal either way)
export const FRESHNESS_POLARITY: Record<Dimension, 1 | -1 | 0> = {
  hydration: 1,
  oiliness: 0,
  texture: -1,
  pores: -1,
  darkSpots: -1,
  redness: -1,
  fineLines: -1,
  darkCircles: -1,
};

const THRESHOLD = 0.02;

function freshnessIndex(scores: ScoreVector): number {
  let sum = 0;
  let n = 0;
  for (const d of DIMENSIONS) {
    const p = FRESHNESS_POLARITY[d];
    if (p === 0) continue;
    sum += p === 1 ? scores[d] : 1 - scores[d];
    n += 1;
  }
  return n === 0 ? 0 : sum / n;
}

function directionOf(delta: number): TrendDirection {
  if (delta > THRESHOLD) return 'fresher';
  if (delta < -THRESHOLD) return 'more-tired';
  return 'steady';
}

// history is newest-first (matches fetchScanHistory ordering). Compares the latest scan's freshness
// index against the mean of all earlier scans. Relative + within-user — no population claim.
export function computeSkinFreshnessTrend(history: ScoreSnapshot[]): SkinAgeTrend {
  if (history.length < 2) {
    return { direction: 'steady', delta: 0, sampleCount: history.length };
  }
  const [latest, ...earlier] = history;
  const latestIndex = freshnessIndex(latest.scores);
  const baseline = earlier.reduce((acc, s) => acc + freshnessIndex(s.scores), 0) / earlier.length;
  const delta = latestIndex - baseline;
  return { direction: directionOf(delta), delta, sampleCount: history.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/age/__tests__/skin-age-trend.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/features/age/skin-age-trend.ts src/features/age/__tests__/skin-age-trend.test.ts
git commit -m "feat(age): compute within-user skin freshness trend from score history"
```

---

### Task 3: Trend copy (cosmetic-vocabulary safe)

**Files:**
- Create: `src/features/age/age-copy.ts`
- Test: `src/features/age/__tests__/age-copy.test.ts`

**Interfaces:**
- Consumes: `SkinAgeTrend`, `TrendDirection` (Task 1); `findDiseaseTerms` from `src/lib/cosmetic-filter.ts`.
- Produces: `trendCopy(trend: SkinAgeTrend): { headline: string; sub: string }` and `assertTrendCopySafe(text: string): void`.

**Design note:** Fixed, hand-written cosmetic strings (no model output), but we still self-check them against the disease blocklist so a future edit can't smuggle in a banned term. `assertTrendCopySafe` throws if `findDiseaseTerms` matches — fail-closed, mirroring `guardReply`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/age/__tests__/age-copy.test.ts
import { trendCopy, assertTrendCopySafe } from '../age-copy';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import type { SkinAgeTrend } from '../age-types';

const mk = (direction: SkinAgeTrend['direction'], sampleCount = 3): SkinAgeTrend => ({
  direction, delta: 0.1, sampleCount,
});

describe('trendCopy', () => {
  it('produces copy for every direction and never emits a disease term', () => {
    for (const dir of ['fresher', 'steady', 'more-tired'] as const) {
      const { headline, sub } = trendCopy(mk(dir));
      expect(headline.length).toBeGreaterThan(0);
      expect(findDiseaseTerms(headline)).toHaveLength(0);
      expect(findDiseaseTerms(sub)).toHaveLength(0);
    }
  });

  it('explains there is no trend yet when only one scan exists', () => {
    const { sub } = trendCopy(mk('steady', 1));
    expect(sub.toLowerCase()).toContain('scan again');
  });

  it('describes appearance, not diagnosis (no "younger"/medical framing)', () => {
    const { headline } = trendCopy(mk('fresher'));
    expect(headline.toLowerCase()).toContain('look');
  });
});

describe('assertTrendCopySafe', () => {
  it('passes clean cosmetic copy and throws on a disease term', () => {
    expect(() => assertTrendCopySafe('Your skin looks fresher than last time')).not.toThrow();
    expect(() => assertTrendCopySafe('signs of eczema')).toThrow(/blocked/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/age/__tests__/age-copy.test.ts`
Expected: FAIL — `Cannot find module '../age-copy'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/features/age/age-copy.ts
import { findDiseaseTerms } from '../../lib/cosmetic-filter';
import type { SkinAgeTrend } from './age-types';

// Fail-closed self-check: these strings are hand-written and cosmetic, but we still refuse to ship
// any string that trips the disease blocklist (CLAUDE.md §1), so a careless future edit can't leak.
export function assertTrendCopySafe(text: string): void {
  const bad = findDiseaseTerms(text);
  if (bad.length) throw new Error(`blocked disease term in trend copy: ${bad.join(', ')}`);
}

export function trendCopy(trend: SkinAgeTrend): { headline: string; sub: string } {
  if (trend.sampleCount < 2) {
    const copy = {
      headline: 'Your skin trend',
      sub: 'Scan again over the next few weeks to see how your skin looks over time.',
    };
    assertTrendCopySafe(copy.headline);
    assertTrendCopySafe(copy.sub);
    return copy;
  }
  const map: Record<SkinAgeTrend['direction'], { headline: string; sub: string }> = {
    fresher: {
      headline: 'Your skin looks fresher',
      sub: 'Compared with your recent scans, your skin is looking more rested and hydrated.',
    },
    steady: {
      headline: 'Your skin looks steady',
      sub: 'Your skin looks about the same as your recent scans — no notable change.',
    },
    'more-tired': {
      headline: 'Your skin looks more tired',
      sub: 'Compared with your recent scans, your skin looks a little more tired lately.',
    },
  };
  const copy = map[trend.direction];
  assertTrendCopySafe(copy.headline);
  assertTrendCopySafe(copy.sub);
  return copy;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/age/__tests__/age-copy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/age/age-copy.ts src/features/age/__tests__/age-copy.test.ts
git commit -m "feat(age): cosmetic-safe trend copy with fail-closed blocklist self-check"
```

---

### Task 4: DB migration — skin-age columns + extend `record_scan`

**Files:**
- Create: `supabase/migrations/0011_skin_age.sql`

**Interfaces:**
- Consumes: existing `public.scans` table and `public.record_scan(jsonb, text, text, boolean, jsonb, text)` (migration `0010_routine.sql`).
- Produces: columns `scans.skin_age_estimate int null`, `scans.skin_age_confidence numeric(4,3) null`; new RPC `public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric)` (two trailing nullable params, default null).

**Design note:** Adding params changes the function signature, so drop the old overload and recreate. Keep all existing validation verbatim; append range checks for the two new nullable params. New columns are nullable so historical rows and the entire dark-flag period stay valid, and they inherit RLS + retention + `delete_my_data()` automatically (no policy changes).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0011_skin_age.sql
-- Additive: skin-appearance-age columns on scans + extend record_scan to accept them.
-- Both columns nullable; absolute age stays NULL until SKIN_AGE_ABSOLUTE_ENABLED is flipped
-- (validation gate, CLAUDE.md §1). Inherits scans RLS, retention sweep, and delete_my_data().

alter table public.scans
  add column if not exists skin_age_estimate int null
    check (skin_age_estimate is null or skin_age_estimate between 0 and 120),
  add column if not exists skin_age_confidence numeric(4,3) null
    check (skin_age_confidence is null or skin_age_confidence between 0 and 1);

-- Replace the 6-arg RPC with an 8-arg version (two trailing nullable params).
drop function if exists public.record_scan(jsonb, text, text, boolean, jsonb, text);

create or replace function public.record_scan(
  p_scores jsonb, p_skin_type text, p_model_version text, p_is_stub boolean,
  p_routine jsonb, p_routine_version text,
  p_skin_age int default null, p_skin_age_confidence numeric default null)
returns public.scans
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_row public.scans;
        v_keys text[] := array['hydration','oiliness','texture','pores',
                               'darkSpots','redness','fineLines','darkCircles'];
        v_k text; v_v numeric;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  if p_skin_type not in ('dry','oily','combination','sensitive') then
    raise exception 'invalid skin type' using errcode='P0001';
  end if;
  foreach v_k in array v_keys loop
    if jsonb_typeof(p_scores -> v_k) is distinct from 'number' then
      raise exception 'missing or non-numeric score: %', v_k using errcode='P0001';
    end if;
    v_v := (p_scores ->> v_k)::numeric;
    if v_v < 0 or v_v > 1 then raise exception 'score out of range: %', v_k using errcode='P0001'; end if;
  end loop;
  if jsonb_typeof(p_routine -> 'version') is distinct from 'string'
     or jsonb_typeof(p_routine -> 'am') is distinct from 'array'
     or jsonb_typeof(p_routine -> 'pm') is distinct from 'array' then
    raise exception 'malformed routine' using errcode='P0001';
  end if;
  if coalesce(p_routine_version, '') = '' then
    raise exception 'missing routine version' using errcode='P0001';
  end if;
  if p_skin_age is not null and (p_skin_age < 0 or p_skin_age > 120) then
    raise exception 'skin age out of range' using errcode='P0001';
  end if;
  if p_skin_age_confidence is not null and (p_skin_age_confidence < 0 or p_skin_age_confidence > 1) then
    raise exception 'skin age confidence out of range' using errcode='P0001';
  end if;

  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture, score_pores,
    score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, is_stub, routine, routine_engine_version,
    skin_age_estimate, skin_age_confidence)
  values (v_uid,
    (p_scores->>'hydration')::numeric, (p_scores->>'oiliness')::numeric,
    (p_scores->>'texture')::numeric, (p_scores->>'pores')::numeric,
    (p_scores->>'darkSpots')::numeric, (p_scores->>'redness')::numeric,
    (p_scores->>'fineLines')::numeric, (p_scores->>'darkCircles')::numeric,
    p_skin_type, p_model_version, p_is_stub, p_routine, p_routine_version,
    p_skin_age, p_skin_age_confidence)
  returning * into v_row;

  update public.profiles set last_interaction_at = now() where id = v_uid;
  return v_row;
end; $$;

revoke all on function public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric) from public;
grant execute on function public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric) to authenticated;
```

- [ ] **Step 2: Apply locally and verify**

Run:
```bash
supabase db reset    # applies all migrations 0001..0011 against local Postgres (port 54321)
```
Expected: completes without error; `0011_skin_age.sql` applied.

Verify columns + new signature:
```bash
supabase db execute "select column_name from information_schema.columns where table_name='scans' and column_name like 'skin_age%';"
# expect: skin_age_estimate, skin_age_confidence
supabase db execute "select pg_get_function_identity_arguments(oid) from pg_proc where proname='record_scan';"
# expect: jsonb, text, text, boolean, jsonb, text, integer, numeric
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_skin_age.sql
git commit -m "feat(db): add nullable skin_age columns and extend record_scan RPC"
```

---

### Task 5: Persist age through the data layer

**Files:**
- Modify: `src/lib/scans.ts`
- Test: `src/lib/__tests__/scans-age.test.ts`

**Interfaces:**
- Consumes: `SkinAgeEstimate` (Task 1); existing `recordScan(r: ReadResult)`, `Scan` type, and `rowToScan` in `src/lib/scans.ts`.
- Produces: `recordScan` forwards `p_skin_age` / `p_skin_age_confidence` to the RPC; `Scan` gains `skinAge: number | null` and `skinAgeConfidence: number | null`; `recordScan` accepts an optional second arg `age?: SkinAgeEstimate | null` (defaults null) so the read pipeline (Task 7) injects the estimate.

**Design note:** Keep `recordScan` signature backward-compatible by adding an optional `age` param. While the engine is dark it always passes `null`, so the persisted columns stay null — exactly the intended dark behavior. Mock `supabase.rpc` to assert the params.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/scans-age.test.ts
jest.mock('../supabase', () => ({
  supabase: { rpc: jest.fn().mockResolvedValue({ error: null }) },
}));
jest.mock('../../features/recommend/routine/build-routine', () => ({
  buildRoutine: () => ({ version: 'r1', am: [], pm: [], notes: [] }),
}));

import { recordScan } from '../scans';
import { supabase } from '../supabase';
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import type { ReadResult } from '../../features/read/read-types';

const read: ReadResult = {
  scores: Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ReadResult['scores'],
  skinType: 'combination',
  modelVersion: 'stub-1',
  isStub: true,
};

beforeEach(() => (supabase.rpc as jest.Mock).mockClear());

test('records null skin-age params when no estimate is provided (dark default)', async () => {
  await recordScan(read);
  const args = (supabase.rpc as jest.Mock).mock.calls[0][1];
  expect(args.p_skin_age).toBeNull();
  expect(args.p_skin_age_confidence).toBeNull();
});

test('forwards a provided skin-age estimate to the RPC', async () => {
  await recordScan(read, { ageEstimate: 31, confidence: 0.7, modelVersion: 'age-1' });
  const args = (supabase.rpc as jest.Mock).mock.calls[0][1];
  expect(args.p_skin_age).toBe(31);
  expect(args.p_skin_age_confidence).toBe(0.7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/scans-age.test.ts`
Expected: FAIL — `recordScan` ignores/rejects the second arg and `p_skin_age` is undefined.

- [ ] **Step 3: Modify `recordScan` and `Scan`/`rowToScan`**

In `src/lib/scans.ts`, update the `recordScan` signature and RPC payload:

```typescript
import type { SkinAgeEstimate } from '../features/age/age-types';

export async function recordScan(r: ReadResult, age: SkinAgeEstimate | null = null): Promise<void> {
  const routine = buildRoutine(skincareDomain, { scores: r.scores, skinType: r.skinType });
  const { error } = await supabase.rpc('record_scan', {
    p_scores: r.scores,
    p_skin_type: r.skinType,
    p_model_version: r.modelVersion,
    p_is_stub: r.isStub,
    p_routine: routine,
    p_routine_version: routine.version,
    p_skin_age: age?.ageEstimate ?? null,
    p_skin_age_confidence: age?.confidence ?? null,
  });
  if (error) throw new Error('record-scan-failed');
}
```

Add the two fields to the `Scan` type and map them in `rowToScan` (read `skin_age_estimate` / `skin_age_confidence`, coercing to `number | null`):

```typescript
// in the Scan type:
  skinAge: number | null;
  skinAgeConfidence: number | null;

// in rowToScan(row), alongside the other fields:
  skinAge: row.skin_age_estimate == null ? null : Number(row.skin_age_estimate),
  skinAgeConfidence: row.skin_age_confidence == null ? null : Number(row.skin_age_confidence),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/scans-age.test.ts`
Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scans.ts src/lib/__tests__/scans-age.test.ts
git commit -m "feat(age): persist optional skin-age estimate through recordScan"
```

---

### Task 6: On-device skin-age engine (dark)

**Files:**
- Create: `src/features/age/skin-age-engine.ts`
- Test: `src/features/age/__tests__/skin-age-engine.test.ts`

**Interfaces:**
- Consumes: `ReadResult` from `src/features/read/read-types.ts`; `SkinAgeEstimate` (Task 1); `SKIN_AGE_ABSOLUTE_ENABLED` (Task 1); `DIMENSIONS` from `src/content/cosmetic-vocab.ts`.
- Produces: `estimateSkinAge(read: ReadResult): SkinAgeEstimate | null` and `AGE_MODEL_VERSION: string`.

**Design note:** When the flag is off, return `null` — this is the shipping behavior, so nothing reaches the column. When on (future/tests), run a pure deterministic transform from the appearance scores (placeholder for the real on-device model, which is marked `// DEVICE-ONLY`). The transform is host-testable; the real executorch model swap happens behind the same flag during the validation track. Test the flag both ways using `jest.doMock`/`jest.resetModules` so we exercise the enabled path without shipping it on.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/age/__tests__/skin-age-engine.test.ts
import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ReadResult } from '../../read/read-types';

const read: ReadResult = {
  scores: Object.fromEntries(DIMENSIONS.map((d) => [d, 0.5])) as ReadResult['scores'],
  skinType: 'combination',
  modelVersion: 'stub-1',
  isStub: true,
};

describe('estimateSkinAge', () => {
  afterEach(() => jest.resetModules());

  it('returns null while the absolute-age flag is dark (default)', () => {
    jest.resetModules();
    const { estimateSkinAge } = require('../skin-age-engine');
    expect(estimateSkinAge(read)).toBeNull();
  });

  it('produces a bounded, confident estimate when the flag is enabled', () => {
    jest.resetModules();
    jest.doMock('../age-flags', () => ({ SKIN_AGE_ABSOLUTE_ENABLED: true }));
    const { estimateSkinAge, AGE_MODEL_VERSION } = require('../skin-age-engine');
    const est = estimateSkinAge(read)!;
    expect(est).not.toBeNull();
    expect(est.ageEstimate).toBeGreaterThanOrEqual(0);
    expect(est.ageEstimate).toBeLessThanOrEqual(120);
    expect(est.confidence).toBeGreaterThanOrEqual(0);
    expect(est.confidence).toBeLessThanOrEqual(1);
    expect(est.modelVersion).toBe(AGE_MODEL_VERSION);
    jest.dontMock('../age-flags');
  });

  it('is deterministic for the same read', () => {
    jest.resetModules();
    jest.doMock('../age-flags', () => ({ SKIN_AGE_ABSOLUTE_ENABLED: true }));
    const { estimateSkinAge } = require('../skin-age-engine');
    expect(estimateSkinAge(read)).toEqual(estimateSkinAge(read));
    jest.dontMock('../age-flags');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/age/__tests__/skin-age-engine.test.ts`
Expected: FAIL — `Cannot find module '../skin-age-engine'`.

- [ ] **Step 3: Write the engine**

```typescript
// src/features/age/skin-age-engine.ts
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import type { ReadResult } from '../read/read-types';
import type { SkinAgeEstimate } from './age-types';
import { SKIN_AGE_ABSOLUTE_ENABLED } from './age-flags';

export const AGE_MODEL_VERSION = 'age-stub-1';

// Placeholder deterministic transform mapping appearance scores -> a "looks like ~N" estimate.
// DEVICE-ONLY: the real implementation swaps this for an on-device executorch model that runs in the
// same pass as the read, before the image is deleted. Until validation data is on file, the whole
// path is gated dark by SKIN_AGE_ABSOLUTE_ENABLED and estimateSkinAge returns null.
function transform(read: ReadResult): SkinAgeEstimate {
  // Lines/spots/texture push the estimate up; hydration pulls it down. Centered around a base age.
  const s = read.scores;
  const visible = (s.fineLines + s.darkSpots + s.texture + s.darkCircles) / 4;
  const raw = 25 + visible * 40 - s.hydration * 8;
  const ageEstimate = Math.max(0, Math.min(120, Math.round(raw)));
  const spread = DIMENSIONS.reduce((acc, d) => acc + Math.abs(s[d] - 0.5), 0) / DIMENSIONS.length;
  const confidence = Math.max(0, Math.min(1, Number((0.4 + spread).toFixed(3))));
  return { ageEstimate, confidence, modelVersion: AGE_MODEL_VERSION };
}

export function estimateSkinAge(read: ReadResult): SkinAgeEstimate | null {
  if (!SKIN_AGE_ABSOLUTE_ENABLED) return null;
  return transform(read);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/age/__tests__/skin-age-engine.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/features/age/skin-age-engine.ts src/features/age/__tests__/skin-age-engine.test.ts
git commit -m "feat(age): on-device skin-age engine, dark behind SKIN_AGE_ABSOLUTE_ENABLED"
```

---

### Task 7: Wire the engine into the read pipeline

**Files:**
- Modify: `src/features/read/run-stub-read.ts` (and the real `src/features/read/run-read.ts` if present on `main` — apply the identical change to whichever the scan route calls)
- Test: `src/features/read/__tests__/run-stub-read-age.test.ts`

**Interfaces:**
- Consumes: `estimateSkinAge` (Task 6); `recordScan(r, age)` (Task 5); existing `stubRead()` and `withImageCleanup`.
- Produces: the read pipeline computes the age estimate from the `ReadResult` **before image deletion** and passes it to `recordScan`. No new exported symbol.

**Design note:** The estimate is derived from the `ReadResult` (already in memory), so it is computed inside the `withImageCleanup` callback — before the `finally` deletes the image — and handed to `recordScan`. While dark, `estimateSkinAge` returns null, so behavior is unchanged. The test asserts `recordScan` receives the engine's output.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/read/__tests__/run-stub-read-age.test.ts
const recordScan = jest.fn().mockResolvedValue(undefined);
const estimateSkinAge = jest.fn().mockReturnValue({ ageEstimate: 33, confidence: 0.6, modelVersion: 'age-stub-1' });

jest.mock('../../../lib/scans', () => ({ recordScan }));
jest.mock('../../age/skin-age-engine', () => ({ estimateSkinAge }));
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn().mockResolvedValue(undefined) }));

import { runStubRead } from '../run-stub-read';

beforeEach(() => { recordScan.mockClear(); estimateSkinAge.mockClear(); });

test('computes the age estimate and passes it to recordScan', async () => {
  await runStubRead('file://photo.jpg');
  expect(estimateSkinAge).toHaveBeenCalledTimes(1);
  expect(recordScan).toHaveBeenCalledTimes(1);
  expect(recordScan.mock.calls[0][1]).toEqual({ ageEstimate: 33, confidence: 0.6, modelVersion: 'age-stub-1' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/read/__tests__/run-stub-read-age.test.ts`
Expected: FAIL — `recordScan` called with one arg; `estimateSkinAge` not called.

- [ ] **Step 3: Wire it in**

In `src/features/read/run-stub-read.ts`, inside the `withImageCleanup` callback (before cleanup runs), compute the estimate and pass it through:

```typescript
import { estimateSkinAge } from '../age/skin-age-engine';
// ...
await withImageCleanup(photoUri, async () => {
  const result = stubRead();
  const age = estimateSkinAge(result); // null while dark; computed before the image is deleted
  await recordScan(result, age);
}, deleteAsync);
```

Apply the identical two-line change (compute `estimateSkinAge(result)`, pass as 2nd arg to `recordScan`) to `src/features/read/run-read.ts` on `main` if the scan route uses the real engine path.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/read/__tests__/run-stub-read-age.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/read/run-stub-read.ts src/features/read/__tests__/run-stub-read-age.test.ts
git commit -m "feat(age): compute skin-age in the read pass before image deletion"
```

---

### Task 8: Premium entitlement abstraction (local stub)

**Files:**
- Create: `src/features/premium/entitlement.ts`
- Test: `src/features/premium/__tests__/entitlement.test.ts`

**Interfaces:**
- Consumes: nothing external (deliberately — billing must not import scores/read modules).
- Produces: `interface EntitlementSource { hasAgeAccess(): boolean }`, `setEntitlementSource(src: EntitlementSource): void`, `hasAgeAccess(): boolean`, and a `localStubEntitlement(enabled: boolean): EntitlementSource`.

**Design note:** A swappable source so the real RevenueCat adapter (Task 10) drops in without touching callers, and tests/dev can force access. Default source returns `false` (locked). This module imports nothing from the scan/score path — that isolation is the compliance guarantee, and the test asserts the module graph stays clean.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/premium/__tests__/entitlement.test.ts
import { hasAgeAccess, setEntitlementSource, localStubEntitlement } from '../entitlement';

describe('entitlement', () => {
  it('defaults to locked (no access)', () => {
    expect(hasAgeAccess()).toBe(false);
  });
  it('reflects the injected source', () => {
    setEntitlementSource(localStubEntitlement(true));
    expect(hasAgeAccess()).toBe(true);
    setEntitlementSource(localStubEntitlement(false));
    expect(hasAgeAccess()).toBe(false);
  });
  it('does not import scan/score/read modules (compliance isolation)', () => {
    const src = require('fs').readFileSync(require.resolve('../entitlement.ts'), 'utf8');
    expect(src).not.toMatch(/scans|read-types|skin-age|cosmetic-vocab/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/premium/__tests__/entitlement.test.ts`
Expected: FAIL — `Cannot find module '../entitlement'`.

- [ ] **Step 3: Write the abstraction**

```typescript
// src/features/premium/entitlement.ts
// Gates DISPLAY of premium age features only. MUST NOT import scores, reads, or the image — billing
// never sees biometric/health data (CLAUDE.md §1/§3). Real RevenueCat adapter plugs in via
// setEntitlementSource without changing callers.
export interface EntitlementSource {
  hasAgeAccess(): boolean;
}

export function localStubEntitlement(enabled: boolean): EntitlementSource {
  return { hasAgeAccess: () => enabled };
}

let source: EntitlementSource = localStubEntitlement(false);

export function setEntitlementSource(src: EntitlementSource): void {
  source = src;
}

export function hasAgeAccess(): boolean {
  return source.hasAgeAccess();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/premium/__tests__/entitlement.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/features/premium/entitlement.ts src/features/premium/__tests__/entitlement.test.ts
git commit -m "feat(premium): entitlement abstraction with locked local stub"
```

---

### Task 9: Premium age/trend card + attach to Result

**Files:**
- Create: `src/features/age/AgeTrendCard.tsx`
- Modify: `src/features/read/Result.tsx` (insert the card after the "Your skin today" block, before the dermatologist disclaimer)
- Test: `src/features/age/__tests__/AgeTrendCard.test.tsx`

**Interfaces:**
- Consumes: `computeSkinFreshnessTrend` (Task 2), `trendCopy` (Task 3), `hasAgeAccess` (Task 8), `SKIN_AGE_ABSOLUTE_ENABLED` (Task 1), `ScoreSnapshot` (Task 1). Reuses `GlassCard`, `Display`, `Body`, `Caption` from the existing design system used in `Result.tsx`.
- Produces: `AgeTrendCard({ history, skinAge }: { history: ScoreSnapshot[]; skinAge: number | null })`.

**Design note:** Locked (no entitlement) → render an upsell prompt, no trend. Unlocked → render the trend headline/sub from `trendCopy(computeSkinFreshnessTrend(history))`. The absolute number renders ONLY when `SKIN_AGE_ABSOLUTE_ENABLED && skinAge != null` — while dark it is never shown. `Result.tsx` builds `history` from the scans it already fetches (`fetchScanHistory`) and passes `skinAge` from the latest scan. Add the new UI file to `coveragePathIgnorePatterns` only if native deps block coverage, following the `Capture.tsx` precedent; the card's logic is exercised here via RTL.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/age/__tests__/AgeTrendCard.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { AgeTrendCard } from '../AgeTrendCard';
import { setEntitlementSource, localStubEntitlement } from '../../premium/entitlement';
import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ScoreVector } from '../../read/read-types';

const vec = (f: number): ScoreVector => Object.fromEntries(DIMENSIONS.map((d) => [d, f])) as ScoreVector;
const history = [
  { capturedAt: '2026-06-10', scores: { ...vec(0.2), hydration: 0.9 } },
  { capturedAt: '2026-06-01', scores: { ...vec(0.6), hydration: 0.3 } },
];

test('shows an upsell and no trend when locked', () => {
  setEntitlementSource(localStubEntitlement(false));
  const { queryByText, getByText } = render(<AgeTrendCard history={history} skinAge={null} />);
  expect(getByText(/unlock/i)).toBeTruthy();
  expect(queryByText(/looks fresher/i)).toBeNull();
});

test('shows the freshness trend when unlocked', () => {
  setEntitlementSource(localStubEntitlement(true));
  const { getByText } = render(<AgeTrendCard history={history} skinAge={null} />);
  expect(getByText(/looks fresher/i)).toBeTruthy();
});

test('never shows an absolute age number while the flag is dark', () => {
  setEntitlementSource(localStubEntitlement(true));
  const { queryByText } = render(<AgeTrendCard history={history} skinAge={31} />);
  expect(queryByText(/looks like ~?31/i)).toBeNull(); // dark: skinAge present but flag off
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/age/__tests__/AgeTrendCard.test.tsx`
Expected: FAIL — `Cannot find module '../AgeTrendCard'`.

- [ ] **Step 3: Write the card**

```tsx
// src/features/age/AgeTrendCard.tsx
import React from 'react';
import { View } from 'react-native';
import { GlassCard, Display, Body, Caption } from '../../ui'; // match the import path used by Result.tsx
import { computeSkinFreshnessTrend } from './skin-age-trend';
import { trendCopy } from './age-copy';
import { hasAgeAccess } from '../premium/entitlement';
import { SKIN_AGE_ABSOLUTE_ENABLED } from './age-flags';
import type { ScoreSnapshot } from './age-types';

export function AgeTrendCard({ history, skinAge }: { history: ScoreSnapshot[]; skinAge: number | null }) {
  if (!hasAgeAccess()) {
    return (
      <GlassCard flat intensity={30} radius={22} className="px-5 py-4 mt-6">
        <Display className="text-xl mb-1">Skin over time</Display>
        <Body className="text-[13px] text-ink-soft">
          Unlock TrueTone Premium to track how your skin looks over time.
        </Body>
      </GlassCard>
    );
  }
  const trend = computeSkinFreshnessTrend(history);
  const { headline, sub } = trendCopy(trend);
  const showAbsolute = SKIN_AGE_ABSOLUTE_ENABLED && skinAge != null;
  return (
    <GlassCard flat intensity={30} radius={22} className="px-5 py-4 mt-6">
      <Display className="text-xl mb-1">{headline}</Display>
      <Body className="text-[13px] text-ink-soft">{sub}</Body>
      {showAbsolute ? (
        <Body className="text-[13px] text-ink-soft mt-2">Your skin looks like ~{skinAge}.</Body>
      ) : null}
      <Caption className="text-[11px] leading-[16px] mt-2">
        This describes how your skin looks over time, not a medical or biological age.
      </Caption>
    </GlassCard>
  );
}
```

> Adjust the `from '../../ui'` import to the exact barrel/path `Result.tsx` uses for `GlassCard`/`Display`/`Body`/`Caption` (verify by opening `src/features/read/Result.tsx` imports).

- [ ] **Step 4: Attach to `Result.tsx`**

In `src/features/read/Result.tsx`, build `history` from the scans already available and render the card before the dermatologist disclaimer block:

```tsx
import { AgeTrendCard } from '../age/AgeTrendCard';
// history: newest-first ScoreSnapshot[] from the scans this screen already fetched (latest + prev).
// skinAge: latest scan's skinAge (null while dark).
<AgeTrendCard history={history} skinAge={skinAge} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/features/age/__tests__/AgeTrendCard.test.tsx`
Expected: PASS (all 3).

- [ ] **Step 6: Commit**

```bash
git add src/features/age/AgeTrendCard.tsx src/features/read/Result.tsx src/features/age/__tests__/AgeTrendCard.test.tsx
git commit -m "feat(age): premium age/trend card; absolute number stays hidden while dark"
```

---

### Task 10 (deferred — escalation-gated): Real RevenueCat entitlement adapter

> **Do NOT start without founder sign-off.** Adding `react-native-purchases` is a new native vendor (CLAUDE.md §2 names RevenueCat as the payments tool, "later, not MVP"). This task only wires the adapter into the existing `EntitlementSource` seam — it does not change any scan/score code.

**Files:**
- Create: `src/features/premium/revenuecat-source.ts`
- Modify: app bootstrap (where providers mount, e.g. `app/_layout.tsx`) to `setEntitlementSource(revenueCatSource)` after SDK init.

**Steps (when authorized):**
1. Add `react-native-purchases` (EAS dev build required — native module; cannot run in Expo Go). Confirm `npm run check:compliance` still passes (it must not be an analytics/ad SDK on the scan path — RevenueCat is billing-only and never receives face/score data).
2. Implement `revenueCatSource: EntitlementSource` whose `hasAgeAccess()` reads the RevenueCat "premium" entitlement; default closed on any error.
3. Call `setEntitlementSource(revenueCatSource)` at bootstrap. No change to `AgeTrendCard` or any scan module.
4. Verify on a physical device (entitlement gating only; the scan path is untouched).

---

## Self-Review

**1. Spec coverage:**
- Trend half (ships now) → Tasks 2, 3, 9. ✓
- Absolute age, dark behind `SKIN_AGE_ABSOLUTE_ENABLED` → Tasks 1, 6, 9 (hidden render). ✓
- On-device, before image deletion → Task 7. ✓
- Only derived number crosses; image stays on device → Task 7 (inside `withImageCleanup`). ✓
- Additive `skin_age` columns inheriting RLS/retention/delete → Task 4. ✓
- RevenueCat gates display, not capture; no scores/image to billing → Tasks 8, 10 + isolation test. ✓
- Cosmetic-vocabulary post-filter on age copy → Task 3. ✓
- Fairness across Fitzpatrick I–VI before any flip → out of code scope; called out in spec §5/§7 as a validation-track precondition to flipping the flag, not an engineering task here. Noted, no code task. ✓
- Escalation: flipping the flag + final wording need sign-off → encoded in Global Constraints + Task 10 gate. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code. The one explicit deferral (Task 10) is gated by design, not a placeholder. ✓

**3. Type consistency:** `SkinAgeEstimate` (`ageEstimate`/`confidence`/`modelVersion`) used identically in Tasks 1, 5, 6, 7. `ScoreSnapshot` used in Tasks 1, 2, 9. `EntitlementSource.hasAgeAccess` consistent in Tasks 8, 9, 10. `recordScan(r, age)` signature matches between Tasks 5 and 7. RPC param names `p_skin_age`/`p_skin_age_confidence` match between Tasks 4 and 5. ✓

**Open item for the implementer:** confirm the exact design-system import path for `GlassCard`/`Display`/`Body`/`Caption` (Task 9) by reading `Result.tsx`'s imports on `main`, and confirm whether the scan route calls `run-stub-read` or `run-read` (Task 7) so the two-line wiring lands in the right file.
