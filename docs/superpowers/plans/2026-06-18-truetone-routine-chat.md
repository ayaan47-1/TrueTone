# Brand-Neutral Routine + Scoped Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After an on-device read, generate a brand-neutral skincare routine (deterministic, on-device) and offer a scores-only Claude chat (single Supabase Edge Function) that explains the user's read and routine — never diagnosing, never touching the image.

**Architecture:** A pure, deterministic recommendation engine turns derived scores + skin type into an approved-vocabulary routine on-device; the routine is persisted on the existing `scans` row (inheriting all RLS/retention/delete machinery). A single Edge Function `routine-chat` is the only LLM/network piece: it loads the caller's scores+routine under RLS, short-circuits medical queries to a dermatologist referral, builds a constrained Claude prompt, and runs every reply through the existing cosmetic post-filter (fail-closed). Chat is ephemeral. A thin `RecommendationDomain` seam leaves room for a future makeup sub-project without a refactor.

**Tech Stack:** Expo SDK 56 + React Native + TypeScript · Expo Router · NativeWind · Supabase (Postgres + RLS + Edge Functions, US region) · Anthropic API (Claude Sonnet 4.6) · Jest + @testing-library/react-native · pgTAP.

**Spec:** `docs/superpowers/specs/2026-06-18-truetone-routine-chat-design.md`

## Global Constraints

- **Compliance vocabulary (CLAUDE.md §1):** every user-facing string is cosmetic-only. Routine content is drawn ONLY from the approved library; chat output passes `src/lib/cosmetic-filter.ts` (fail-closed). No disease term from `DISEASE_BLOCKLIST` may ever surface.
- **No image, ever (CLAUDE.md §3):** this feature is entirely post-read. No task may add an image field to any payload, table, or prompt. `npm run check:no-egress` must stay green.
- **No analytics/ad SDK (CLAUDE.md §1):** `npm run check:compliance` must stay green. The Anthropic API is called ONLY server-side from the Edge Function; the key is never in the app bundle.
- **Scores-only across the boundary (CLAUDE.md §3):** only derived scores + routine text cross to the backend; the chat prompt uses band labels, not raw numbers presented as medical fact.
- **Hard refuse medical (CLAUDE.md §1):** any mole/lesion/cancer/melanoma query returns the dermatologist-referral message; the LLM is NOT called on that path.
- **Persistence:** routine saved on the `scans` row; chat is ephemeral (no transcript stored).
- **Dimensions (camelCase, the single source of truth):** `hydration, oiliness, texture, pores, darkSpots, redness, fineLines, darkCircles`. Skin types: `dry, oily, combination, sensitive`.
- **Coverage gate:** Jest global thresholds (lines/statements 80, branches 70, functions 80) must hold.
- **LLM vendor disclosure is a flagged launch-blocker (spec §4.3)** — NOT resolved in code here.

---

## File Structure

**Pure recommendation engine (new, `src/features/recommend/`):**
- `routine-types.ts` — `Routine`, `RoutineStep`, `RecommendationAttrs` types.
- `domain.ts` — `RecommendationDomain` interface (the makeup-ready seam).
- `skincare/library.ts` — authored approved categories + habits + rationale copy (the content artifact).
- `skincare/rules.ts` — pure `(scores, skinType) → category keys`.
- `skincare/domain.ts` — the skincare `RecommendationDomain` implementation.
- `routine-engine.ts` — `buildRoutine(domain, attrs) → Routine`.

**Pure chat logic (new, `src/features/recommend/chat/`) — Jest-tested, Deno-importable, no Metro/Deno deps:**
- `refusal.ts` — `isMedicalQuery`, `REFERRAL_MESSAGE`.
- `prompt.ts` — `buildChatPrompt` (band-label context, routine, history).
- `guard.ts` — `guardReply` (fail-closed post-filter wrapper) + `FALLBACK_MESSAGE`.
- `handle.ts` — `handleChat(deps, input)` pure orchestration (auth/db/anthropic injected).

**Backend (new/modified):**
- `supabase/migrations/0010_routine.sql` — add `routine`/`routine_engine_version` to `scans`; extend `record_scan`.
- `supabase/tests/routine_rpcs.test.sql` — pgTAP for the extended RPC + delete/retention coverage.
- `supabase/functions/routine-chat/index.ts` — thin Deno handler over `handle.ts`.

**Client (new/modified):**
- `src/lib/scans.ts` — extend `recordScan` to compute + persist the routine; `rowToScan` to read it.
- `src/lib/routine-chat.ts` — client caller for the Edge Function.
- `src/features/recommend/RoutineView.tsx` — routine display.
- `src/features/recommend/ChatScreen.tsx` — ephemeral chat UI.
- `app/scan/routine.tsx` — Expo Router route.

---

## Phase 1 — Pure recommendation engine (on-device, deterministic)

### Task 1: Routine types + domain seam

**Files:**
- Create: `src/features/recommend/routine-types.ts`
- Create: `src/features/recommend/domain.ts`
- Test: `src/features/recommend/__tests__/domain.test.ts`

**Interfaces:**
- Consumes: `ScoreVector`, `SkinTypeFeel` from `src/features/read/read-types.ts`.
- Produces:
  - `interface RoutineStep { category: string; habit: string; rationale: string; dimensions: Dimension[] }`
  - `interface Routine { version: string; am: RoutineStep[]; pm: RoutineStep[]; notes: string[] }`
  - `interface RecommendationAttrs { scores: ScoreVector; skinType: SkinTypeFeel }`
  - `interface RecommendationDomain { id: string; version: string; buildRoutine(attrs: RecommendationAttrs): Routine }`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/recommend/__tests__/domain.test.ts
import type { RecommendationDomain, Routine } from '../domain';
import type { RecommendationAttrs } from '../routine-types';

// A trivial in-test domain proves the seam's shape compiles and is usable.
const fake: RecommendationDomain = {
  id: 'test',
  version: 'test-1',
  buildRoutine: (_attrs: RecommendationAttrs): Routine => ({
    version: 'test-1', am: [], pm: [], notes: [],
  }),
};

test('a domain exposes id, version, and buildRoutine returning a Routine', () => {
  const r = fake.buildRoutine({
    scores: {
      hydration: 0.5, oiliness: 0.5, texture: 0.5, pores: 0.5,
      darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5,
    },
    skinType: 'combination',
  });
  expect(fake.id).toBe('test');
  expect(r.version).toBe('test-1');
  expect(Array.isArray(r.am)).toBe(true);
  expect(Array.isArray(r.pm)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/recommend/__tests__/domain.test.ts`
Expected: FAIL — cannot find module `../domain` / `../routine-types`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/recommend/routine-types.ts
import type { Dimension } from '../../content/cosmetic-vocab';
import type { ScoreVector, SkinTypeFeel } from '../read/read-types';

export interface RoutineStep {
  category: string;   // approved category, e.g. "gentle hydrating cleanser"
  habit: string;      // approved habit, e.g. "use lukewarm water, pat dry"
  rationale: string;  // approved phrasing, e.g. "for the appearance of dryness"
  dimensions: Dimension[]; // which scores drove this step (audit/UX)
}

export interface Routine {
  version: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  notes: string[];
}

export interface RecommendationAttrs {
  scores: ScoreVector;
  skinType: SkinTypeFeel;
}
```

```typescript
// src/features/recommend/domain.ts
import type { RecommendationAttrs, Routine } from './routine-types';
export type { RecommendationAttrs, Routine, RoutineStep } from './routine-types';

export interface RecommendationDomain {
  id: string;       // 'skincare' now; 'makeup' later
  version: string;  // stamped into Routine.version + scans.routine_engine_version
  buildRoutine(attrs: RecommendationAttrs): Routine;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/recommend/__tests__/domain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/routine-types.ts src/features/recommend/domain.ts src/features/recommend/__tests__/domain.test.ts
git commit -m "feat(recommend): routine types + RecommendationDomain seam"
```

---

### Task 2: Skincare library (approved content) + compliance invariant

**Files:**
- Create: `src/features/recommend/skincare/library.ts`
- Test: `src/features/recommend/__tests__/library.test.ts`

**Interfaces:**
- Consumes: `findDiseaseTerms` from `src/lib/cosmetic-filter.ts`.
- Produces:
  - `type CategoryKey` (string-literal union of category keys).
  - `interface LibraryEntry { key: CategoryKey; category: string; habit: string; rationale: string; slot: 'am' | 'pm' | 'both' }`
  - `const SKINCARE_LIBRARY: Record<CategoryKey, LibraryEntry>`
  - `const SKINCARE_NOTES: Record<string, string>` (skin-type-feel → an approved note).

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/recommend/__tests__/library.test.ts
import { SKINCARE_LIBRARY, SKINCARE_NOTES } from '../skincare/library';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';

const allStrings = [
  ...Object.values(SKINCARE_LIBRARY).flatMap((e) => [e.category, e.habit, e.rationale]),
  ...Object.values(SKINCARE_NOTES),
];

test('every library string is free of any disease/diagnostic term (compliance invariant)', () => {
  for (const s of allStrings) {
    expect(findDiseaseTerms(s)).toEqual([]);
  }
});

test('every library string is non-empty and brand-neutral (no capitalised brand-like tokens list)', () => {
  for (const s of allStrings) {
    expect(s.trim().length).toBeGreaterThan(0);
  }
});

test('each entry declares a valid slot', () => {
  for (const e of Object.values(SKINCARE_LIBRARY)) {
    expect(['am', 'pm', 'both']).toContain(e.slot);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/recommend/__tests__/library.test.ts`
Expected: FAIL — cannot find module `../skincare/library`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/recommend/skincare/library.ts
// Authored, counsel-reviewable catalog of APPROVED, BRAND-NEUTRAL cosmetic categories + habits.
// Every string here is user-facing and MUST contain no disease/diagnostic term (enforced by test).
// Placeholder copy pending IL counsel review — same posture as cosmetic-vocab BAND_LABELS.

export type CategoryKey =
  | 'gentle_cleanser' | 'hydrating_serum' | 'oil_control' | 'gentle_exfoliant'
  | 'brightening_serum' | 'soothing_moisturizer' | 'daily_spf' | 'eye_care' | 'barrier_moisturizer';

export interface LibraryEntry {
  key: CategoryKey;
  category: string;
  habit: string;
  rationale: string;
  slot: 'am' | 'pm' | 'both';
}

export const SKINCARE_LIBRARY: Record<CategoryKey, LibraryEntry> = {
  gentle_cleanser: {
    key: 'gentle_cleanser',
    category: 'a gentle hydrating cleanser',
    habit: 'cleanse with lukewarm water, then pat dry',
    rationale: 'a mild base step that suits most skin',
    slot: 'both',
  },
  hydrating_serum: {
    key: 'hydrating_serum',
    category: 'a hydrating serum (e.g. hyaluronic acid type)',
    habit: 'apply to slightly damp skin',
    rationale: 'for skin that looks dehydrated',
    slot: 'both',
  },
  oil_control: {
    key: 'oil_control',
    category: 'a lightweight, oil-free moisturizer',
    habit: 'use a small amount, focusing on drier areas',
    rationale: 'for skin that looks oily',
    slot: 'both',
  },
  gentle_exfoliant: {
    key: 'gentle_exfoliant',
    category: 'a gentle exfoliant (low-strength)',
    habit: 'start once or twice a week, not daily',
    rationale: 'for the look of uneven texture or more visible pores',
    slot: 'pm',
  },
  brightening_serum: {
    key: 'brightening_serum',
    category: 'a brightening serum (e.g. vitamin C type)',
    habit: 'apply in the morning before moisturizer',
    rationale: 'for the appearance of dark spots',
    slot: 'am',
  },
  soothing_moisturizer: {
    key: 'soothing_moisturizer',
    category: 'a soothing, fragrance-free moisturizer',
    habit: 'apply while skin is still slightly damp',
    rationale: 'for skin that looks red or feels sensitive',
    slot: 'both',
  },
  daily_spf: {
    key: 'daily_spf',
    category: 'a broad-spectrum SPF 30+ sunscreen',
    habit: 'apply every morning as the last step, reapply if outdoors',
    rationale: 'a daily habit that supports an even-looking tone over time',
    slot: 'am',
  },
  eye_care: {
    key: 'eye_care',
    category: 'a hydrating eye cream',
    habit: 'gently tap a small amount around the eye area',
    rationale: 'for the appearance of dark circles',
    slot: 'both',
  },
  barrier_moisturizer: {
    key: 'barrier_moisturizer',
    category: 'a richer moisturizer',
    habit: 'apply as the final night-time step',
    rationale: 'for the look of fine lines and dryness',
    slot: 'pm',
  },
};

export const SKINCARE_NOTES: Record<string, string> = {
  dry: 'Your skin reads on the drier side — lean into hydration and gentle, fragrance-free products.',
  oily: 'Your skin reads oilier — lightweight, oil-free textures tend to feel more comfortable.',
  combination: 'Your skin reads as combination — you can tailor richness by area (lighter on the T-zone).',
  sensitive: 'Your skin reads sensitive-feeling — patch-test new products and keep things fragrance-free.',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/recommend/__tests__/library.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/skincare/library.ts src/features/recommend/__tests__/library.test.ts
git commit -m "feat(recommend): approved brand-neutral skincare library + compliance invariant test"
```

---

### Task 3: Skincare rules (scores + skin type → category keys)

**Files:**
- Create: `src/features/recommend/skincare/rules.ts`
- Test: `src/features/recommend/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: `CategoryKey` from `./library`; `ScoreVector`, `SkinTypeFeel` from read-types.
- Produces: `function selectCategories(attrs: RecommendationAttrs): CategoryKey[]` — deterministic, order-stable, always includes the universal base steps.

**Rules (deterministic, threshold = 0.6 means "elevated / more visible"):**
- Always: `gentle_cleanser`, `daily_spf`.
- `skinType === 'oily'` OR `oiliness >= 0.6` → `oil_control`; else `hydration <= 0.4` → `hydrating_serum`.
- `skinType === 'sensitive'` OR `redness >= 0.6` → `soothing_moisturizer`.
- `texture >= 0.6` OR `pores >= 0.6` → `gentle_exfoliant`.
- `darkSpots >= 0.6` → `brightening_serum`.
- `darkCircles >= 0.6` → `eye_care`.
- `fineLines >= 0.6` → `barrier_moisturizer`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/recommend/__tests__/rules.test.ts
import { selectCategories } from '../skincare/rules';
import type { ScoreVector } from '../../read/read-types';

const flat = (v: number): ScoreVector => ({
  hydration: v, oiliness: v, texture: v, pores: v,
  darkSpots: v, redness: v, fineLines: v, darkCircles: v,
});

test('always includes the universal base steps', () => {
  const keys = selectCategories({ scores: flat(0.5), skinType: 'combination' });
  expect(keys).toContain('gentle_cleanser');
  expect(keys).toContain('daily_spf');
});

test('oily skin type selects oil control, not a hydrating serum', () => {
  const keys = selectCategories({ scores: flat(0.5), skinType: 'oily' });
  expect(keys).toContain('oil_control');
  expect(keys).not.toContain('hydrating_serum');
});

test('low hydration on non-oily skin selects a hydrating serum', () => {
  const keys = selectCategories({ scores: { ...flat(0.5), hydration: 0.2 }, skinType: 'dry' });
  expect(keys).toContain('hydrating_serum');
});

test('elevated dark spots select a brightening serum', () => {
  const keys = selectCategories({ scores: { ...flat(0.3), darkSpots: 0.8 }, skinType: 'combination' });
  expect(keys).toContain('brightening_serum');
});

test('output is deterministic and order-stable', () => {
  const a = selectCategories({ scores: flat(0.7), skinType: 'sensitive' });
  const b = selectCategories({ scores: flat(0.7), skinType: 'sensitive' });
  expect(a).toEqual(b);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/recommend/__tests__/rules.test.ts`
Expected: FAIL — cannot find module `../skincare/rules`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/recommend/skincare/rules.ts
import type { CategoryKey } from './library';
import type { RecommendationAttrs } from '../routine-types';

const ELEVATED = 0.6;
const LOW = 0.4;

// Deterministic, order-stable selection. Pushed in a fixed order so the routine reads sensibly.
export function selectCategories(attrs: RecommendationAttrs): CategoryKey[] {
  const { scores: s, skinType } = attrs;
  const keys: CategoryKey[] = ['gentle_cleanser'];

  if (skinType === 'oily' || s.oiliness >= ELEVATED) {
    keys.push('oil_control');
  } else if (s.hydration <= LOW) {
    keys.push('hydrating_serum');
  }
  if (skinType === 'sensitive' || s.redness >= ELEVATED) keys.push('soothing_moisturizer');
  if (s.texture >= ELEVATED || s.pores >= ELEVATED) keys.push('gentle_exfoliant');
  if (s.darkSpots >= ELEVATED) keys.push('brightening_serum');
  if (s.darkCircles >= ELEVATED) keys.push('eye_care');
  if (s.fineLines >= ELEVATED) keys.push('barrier_moisturizer');

  keys.push('daily_spf'); // always last in AM ordering
  return keys;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/recommend/__tests__/rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/skincare/rules.ts src/features/recommend/__tests__/rules.test.ts
git commit -m "feat(recommend): deterministic skincare selection rules"
```

---

### Task 4: Routine engine + skincare domain

**Files:**
- Create: `src/features/recommend/skincare/domain.ts`
- Create: `src/features/recommend/routine-engine.ts`
- Test: `src/features/recommend/__tests__/routine-engine.test.ts`

**Interfaces:**
- Consumes: `selectCategories`, `SKINCARE_LIBRARY`, `SKINCARE_NOTES`, `RecommendationDomain`, `findDiseaseTerms`.
- Produces:
  - `const skincareDomain: RecommendationDomain` (id `'skincare'`, version `'skincare-1'`).
  - `function buildRoutine(domain: RecommendationDomain, attrs: RecommendationAttrs): Routine` (passthrough to `domain.buildRoutine`, kept as the public entry point used by the client).

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/recommend/__tests__/routine-engine.test.ts
import { buildRoutine } from '../routine-engine';
import { skincareDomain } from '../skincare/domain';
import { SKINCARE_LIBRARY } from '../skincare/library';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import type { ScoreVector } from '../../read/read-types';

const flat = (v: number): ScoreVector => ({
  hydration: v, oiliness: v, texture: v, pores: v,
  darkSpots: v, redness: v, fineLines: v, darkCircles: v,
});
const libraryCategories = new Set(Object.values(SKINCARE_LIBRARY).map((e) => e.category));

test('stamps the domain version', () => {
  const r = buildRoutine(skincareDomain, { scores: flat(0.5), skinType: 'combination' });
  expect(r.version).toBe('skincare-1');
});

test('every emitted step category comes from the approved library (structural invariant)', () => {
  const r = buildRoutine(skincareDomain, { scores: flat(0.8), skinType: 'sensitive' });
  for (const step of [...r.am, ...r.pm]) {
    expect(libraryCategories.has(step.category)).toBe(true);
  }
});

test('no emitted string contains a disease term', () => {
  const r = buildRoutine(skincareDomain, { scores: flat(0.8), skinType: 'oily' });
  const strings = [...r.am, ...r.pm].flatMap((s) => [s.category, s.habit, s.rationale]).concat(r.notes);
  for (const s of strings) expect(findDiseaseTerms(s)).toEqual([]);
});

test('SPF appears in AM and never in PM', () => {
  const r = buildRoutine(skincareDomain, { scores: flat(0.5), skinType: 'dry' });
  expect(r.am.some((s) => s.category.includes('SPF'))).toBe(true);
  expect(r.pm.some((s) => s.category.includes('SPF'))).toBe(false);
});

test('a PM-only step (exfoliant) never appears in AM', () => {
  const r = buildRoutine(skincareDomain, { scores: { ...flat(0.3), texture: 0.9 }, skinType: 'combination' });
  expect(r.pm.some((s) => s.category.includes('exfoliant'))).toBe(true);
  expect(r.am.some((s) => s.category.includes('exfoliant'))).toBe(false);
});

test('includes the skin-type note', () => {
  const r = buildRoutine(skincareDomain, { scores: flat(0.5), skinType: 'dry' });
  expect(r.notes.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/recommend/__tests__/routine-engine.test.ts`
Expected: FAIL — cannot find module `../routine-engine` / `../skincare/domain`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/recommend/skincare/domain.ts
import type { RecommendationDomain } from '../domain';
import type { RecommendationAttrs, Routine, RoutineStep } from '../routine-types';
import { SKINCARE_LIBRARY, SKINCARE_NOTES } from './library';
import { selectCategories } from './rules';

const VERSION = 'skincare-1';

function toStep(key: ReturnType<typeof selectCategories>[number]): RoutineStep {
  const e = SKINCARE_LIBRARY[key];
  return { category: e.category, habit: e.habit, rationale: e.rationale, dimensions: [] };
}

export const skincareDomain: RecommendationDomain = {
  id: 'skincare',
  version: VERSION,
  buildRoutine(attrs: RecommendationAttrs): Routine {
    const keys = selectCategories(attrs);
    const am: RoutineStep[] = [];
    const pm: RoutineStep[] = [];
    for (const key of keys) {
      const slot = SKINCARE_LIBRARY[key].slot;
      const step = toStep(key);
      if (slot === 'am' || slot === 'both') am.push(step);
      if (slot === 'pm' || slot === 'both') pm.push(step);
    }
    const note = SKINCARE_NOTES[attrs.skinType];
    return { version: VERSION, am, pm, notes: note ? [note] : [] };
  },
};
```

```typescript
// src/features/recommend/routine-engine.ts
import type { RecommendationDomain } from './domain';
import type { RecommendationAttrs, Routine } from './routine-types';

// Public entry point. Kept as a thin function so callers depend on the engine, not a specific domain.
export function buildRoutine(domain: RecommendationDomain, attrs: RecommendationAttrs): Routine {
  return domain.buildRoutine(attrs);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/recommend/__tests__/routine-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/skincare/domain.ts src/features/recommend/routine-engine.ts src/features/recommend/__tests__/routine-engine.test.ts
git commit -m "feat(recommend): routine engine + skincare domain (library-only invariant)"
```

---

## Phase 2 — Backend persistence (routine on the scans row)

### Task 5: Migration — routine columns + extended `record_scan`

**Files:**
- Create: `supabase/migrations/0010_routine.sql`
- Create: `supabase/tests/routine_rpcs.test.sql`

**Interfaces:**
- Produces: `record_scan(p_scores jsonb, p_skin_type text, p_model_version text, p_is_stub boolean, p_routine jsonb, p_routine_version text) returns public.scans`.
- Note: the new params are appended (Postgres has no overloading clash because the arity differs); the old 4-arg signature is dropped to avoid an ambiguous orphan.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/routine_rpcs.test.sql
begin;
select plan(6);

insert into auth.users(id) values ('dddddddd-dddd-dddd-dddd-dddddddddddd');
insert into public.profiles(id, consent_active) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', true);
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';

-- routine column exists
select has_column('public', 'scans', 'routine', 'scans.routine exists');
select has_column('public', 'scans', 'routine_engine_version', 'scans.routine_engine_version exists');

-- record_scan persists the routine atomically with scores
select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true,
    '{"version":"skincare-1","am":[],"pm":[],"notes":[]}'::jsonb, 'skincare-1') $$,
  'record_scan with routine runs');

select is((select routine_engine_version from public.scans
           where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd' limit 1),
  'skincare-1', 'routine version persisted');

-- a routine missing the required "version" key is rejected with the P0001 contract
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true, '{"am":[],"pm":[]}'::jsonb, 'skincare-1') $$,
  'P0001', NULL, 'malformed routine rejected');

-- withdrawing consent purges the scan (routine rides the row)
select public.withdraw_consent();
select is((select count(*) from public.scans where user_id='dddddddd-dddd-dddd-dddd-dddddddddddd')::int,
  0, 'routine purged with scan on consent withdrawal');

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — `record_scan` has no 6-arg form / `routine` column missing.

- [ ] **Step 3: Write minimal implementation**

```sql
-- supabase/migrations/0010_routine.sql
-- Routine is 1:1 with a scan (scores are immutable -> routine is stable). Storing it on the scans
-- row inherits RLS, the §15(a) purpose-met trigger, the 3-year retention cron, delete-everything,
-- and the backup/PITR purge — no new retention/deletion code (spec §3.3).
alter table public.scans
  add column routine jsonb not null default '{}'::jsonb,
  add column routine_engine_version text not null default '';

-- Drop the old 4-arg signature and replace with the 6-arg form that also persists the routine.
drop function if exists public.record_scan(jsonb, text, text, boolean);

create or replace function public.record_scan(
  p_scores jsonb, p_skin_type text, p_model_version text, p_is_stub boolean,
  p_routine jsonb, p_routine_version text)
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
  -- Shape-validate the routine at the boundary (spec §3.2): require the version key + array slots.
  if jsonb_typeof(p_routine -> 'version') is distinct from 'string'
     or jsonb_typeof(p_routine -> 'am') is distinct from 'array'
     or jsonb_typeof(p_routine -> 'pm') is distinct from 'array' then
    raise exception 'malformed routine' using errcode='P0001';
  end if;
  if coalesce(p_routine_version, '') = '' then
    raise exception 'missing routine version' using errcode='P0001';
  end if;

  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture, score_pores,
    score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, is_stub, routine, routine_engine_version)
  values (v_uid,
    (p_scores->>'hydration')::numeric, (p_scores->>'oiliness')::numeric,
    (p_scores->>'texture')::numeric, (p_scores->>'pores')::numeric,
    (p_scores->>'darkSpots')::numeric, (p_scores->>'redness')::numeric,
    (p_scores->>'fineLines')::numeric, (p_scores->>'darkCircles')::numeric,
    p_skin_type, p_model_version, p_is_stub, p_routine, p_routine_version)
  returning * into v_row;

  update public.profiles set last_interaction_at = now() where id = v_uid;
  return v_row;
end; $$;

revoke all on function public.record_scan(jsonb, text, text, boolean, jsonb, text) from public;
grant execute on function public.record_scan(jsonb, text, text, boolean, jsonb, text) to authenticated;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase test db`
Expected: PASS (the new `routine_rpcs` suite plus the existing suites — see Step 5 note).

- [ ] **Step 5: Update the existing scan_rpcs test for the new arity, then commit**

The existing `supabase/tests/scan_rpcs.test.sql` calls `record_scan` with 4 args. Update each call to the 6-arg form by appending `, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1'` before the closing paren (5 call sites: the valid insert, out-of-range, bad skin type, null score, and leave the direct-insert test unchanged).

Run: `npx supabase test db`
Expected: PASS (all suites).

```bash
git add supabase/migrations/0010_routine.sql supabase/tests/routine_rpcs.test.sql supabase/tests/scan_rpcs.test.sql
git commit -m "feat(db): persist routine on scans row + extend record_scan with shape validation"
```

---

### Task 6: Client `recordScan` computes + persists the routine

**Files:**
- Modify: `src/lib/scans.ts`
- Test: `src/lib/__tests__/scans.test.ts` (extend existing)

**Interfaces:**
- Consumes: `buildRoutine`, `skincareDomain`.
- Produces: `recordScan(r: ReadResult)` now builds the routine internally and passes `p_routine` + `p_routine_version`; `Scan` gains `routine: Routine`; `rowToScan` reads `row.routine`.

- [ ] **Step 1: Write the failing test**

```typescript
// add to src/lib/__tests__/scans.test.ts
import { recordScan } from '../scans';
import { supabase } from '../supabase';
import type { ReadResult } from '../../features/read/read-types';

jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn().mockResolvedValue({ error: null }) } }));

const result: ReadResult = {
  scores: {
    hydration: 0.2, oiliness: 0.5, texture: 0.5, pores: 0.5,
    darkSpots: 0.8, redness: 0.5, fineLines: 0.5, darkCircles: 0.5,
  },
  skinType: 'dry', modelVersion: 'stub-1', isStub: true,
};

test('recordScan builds a routine and passes it to the RPC', async () => {
  await recordScan(result);
  const args = (supabase.rpc as jest.Mock).mock.calls[0][1];
  expect(args.p_routine_version).toBe('skincare-1');
  expect(args.p_routine.version).toBe('skincare-1');
  // low hydration on dry skin -> hydrating serum is present somewhere in the routine
  const cats = [...args.p_routine.am, ...args.p_routine.pm].map((s: { category: string }) => s.category);
  expect(cats.some((c: string) => c.includes('hydrating serum'))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/scans.test.ts`
Expected: FAIL — `p_routine` is undefined in the captured args.

- [ ] **Step 3: Write minimal implementation**

Modify `src/lib/scans.ts`: import the engine, build the routine in `recordScan`, add `routine` to `Scan` + `rowToScan`.

```typescript
// top of src/lib/scans.ts — add imports
import { buildRoutine } from '../features/recommend/routine-engine';
import { skincareDomain } from '../features/recommend/skincare/domain';
import type { Routine } from '../features/recommend/routine-types';
```

```typescript
// replace recordScan
export async function recordScan(r: ReadResult): Promise<void> {
  const routine = buildRoutine(skincareDomain, { scores: r.scores, skinType: r.skinType });
  const { error } = await supabase.rpc('record_scan', {
    p_scores: r.scores,
    p_skin_type: r.skinType,
    p_model_version: r.modelVersion,
    p_is_stub: r.isStub,
    p_routine: routine,
    p_routine_version: routine.version,
  });
  if (error) throw new Error('record-scan-failed');
}
```

```typescript
// add routine to the Scan interface
export interface Scan {
  id: string;
  capturedAt: string;
  skinType: string;
  scores: ScoreVector;
  modelVersion: string;
  isStub: boolean;
  routine: Routine;
}
```

```typescript
// in rowToScan, add before return:
  const routine = (row.routine ?? { version: '', am: [], pm: [], notes: [] }) as Routine;
// and add `routine,` to the returned object literal.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/scans.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scans.ts src/lib/__tests__/scans.test.ts
git commit -m "feat(scans): compute + persist routine on record; expose it on fetched scans"
```

---

## Phase 3 — Chat: pure logic, then the Edge Function shell

### Task 7: Input refusal guard

**Files:**
- Create: `src/features/recommend/chat/refusal.ts`
- Test: `src/features/recommend/chat/__tests__/refusal.test.ts`

**Interfaces:**
- Produces: `function isMedicalQuery(message: string): boolean`; `const REFERRAL_MESSAGE: string`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/recommend/chat/__tests__/refusal.test.ts
import { isMedicalQuery, REFERRAL_MESSAGE } from '../refusal';

test.each([
  'is this mole cancer?',
  'I think I have melanoma',
  'can you check this lesion',
  'does this look like skin cancer',
  'is this a carcinoma',
])('flags medical query: %s', (q) => {
  expect(isMedicalQuery(q)).toBe(true);
});

test.each([
  'why is vitamin C in my routine?',
  'how often should I use the exfoliant?',
  'what does the SPF step do',
])('does not flag cosmetic query: %s', (q) => {
  expect(isMedicalQuery(q)).toBe(false);
});

test('referral message points to a dermatologist and does not diagnose', () => {
  expect(REFERRAL_MESSAGE.toLowerCase()).toContain('dermatologist');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/recommend/chat/__tests__/refusal.test.ts`
Expected: FAIL — cannot find module `../refusal`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/recommend/chat/refusal.ts
// Input-side hard refuse (CLAUDE.md §1): any mole/lesion/cancer/melanoma assessment short-circuits
// to a dermatologist referral BEFORE the LLM is called. Defense-in-depth with the output post-filter.
const MEDICAL_TRIGGERS = [
  'mole', 'lesion', 'cancer', 'melanoma', 'carcinoma', 'tumor', 'tumour',
  'biopsy', 'diagnos', 'is this normal', 'should i be worried',
];

export function isMedicalQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return MEDICAL_TRIGGERS.some((t) => lower.includes(t));
}

export const REFERRAL_MESSAGE =
  "I can only describe how skin looks — I can't assess moles, spots, or anything medical. " +
  'If you have a concern about a specific spot or change in your skin, please see a board-certified ' +
  'dermatologist, who can examine it properly.';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/recommend/chat/__tests__/refusal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/chat/refusal.ts src/features/recommend/chat/__tests__/refusal.test.ts
git commit -m "feat(chat): input-side medical-query refusal guard"
```

---

### Task 8: Chat prompt builder

**Files:**
- Create: `src/features/recommend/chat/prompt.ts`
- Test: `src/features/recommend/chat/__tests__/prompt.test.ts`

**Interfaces:**
- Consumes: `BAND_LABELS`, `SKIN_TYPE_LABELS` from cosmetic-vocab; `Routine`, `ScoreVector`, `SkinTypeFeel`.
- Produces:
  - `interface ChatTurn { role: 'user' | 'assistant'; content: string }`
  - `interface PromptInput { scores: ScoreVector; skinType: SkinTypeFeel; routine: Routine; history: ChatTurn[]; message: string }`
  - `function buildChatPrompt(input: PromptInput): { system: string; messages: ChatTurn[] }`
  - `function scoreToBand(dim: Dimension, value: number): string` (helper; exported for test).

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/recommend/chat/__tests__/prompt.test.ts
import { buildChatPrompt, scoreToBand } from '../prompt';
import type { Routine } from '../../routine-types';
import type { ScoreVector } from '../../../read/read-types';

const scores: ScoreVector = {
  hydration: 0.1, oiliness: 0.5, texture: 0.5, pores: 0.5,
  darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5,
};
const routine: Routine = {
  version: 'skincare-1',
  am: [{ category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'apply every morning', rationale: 'daily habit', dimensions: [] }],
  pm: [], notes: ['note'],
};

test('low hydration maps to the lowest band label', () => {
  expect(scoreToBand('hydration', 0.1)).toBe('Looks dehydrated');
});

test('system prompt forbids diagnosis and scopes to the read + routine', () => {
  const { system } = buildChatPrompt({ scores, skinType: 'dry', routine, history: [], message: 'hi' });
  expect(system.toLowerCase()).toContain('dermatologist');
  expect(system.toLowerCase()).toContain('do not diagnose');
});

test('context carries band labels and the routine, never raw numeric scores', () => {
  const { system } = buildChatPrompt({ scores, skinType: 'dry', routine, history: [], message: 'hi' });
  expect(system).toContain('Looks dehydrated');
  expect(system).toContain('a broad-spectrum SPF 30+ sunscreen');
  expect(system).not.toContain('0.1'); // raw scores are never surfaced
});

test('history and the new message are appended in order', () => {
  const { messages } = buildChatPrompt({
    scores, skinType: 'dry', routine,
    history: [{ role: 'user', content: 'earlier' }, { role: 'assistant', content: 'reply' }],
    message: 'why SPF?',
  });
  expect(messages.map((m) => m.content)).toEqual(['earlier', 'reply', 'why SPF?']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/recommend/chat/__tests__/prompt.test.ts`
Expected: FAIL — cannot find module `../prompt`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/recommend/chat/prompt.ts
import { BAND_LABELS, SKIN_TYPE_LABELS, DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { Dimension } from '../../../content/cosmetic-vocab';
import type { ScoreVector, SkinTypeFeel } from '../../read/read-types';
import type { Routine } from '../routine-types';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }
export interface PromptInput {
  scores: ScoreVector; skinType: SkinTypeFeel; routine: Routine; history: ChatTurn[]; message: string;
}

export function scoreToBand(dim: Dimension, value: number): string {
  const [low, mid, high] = BAND_LABELS[dim];
  if (value <= 0.4) return low;
  if (value >= 0.6) return high;
  return mid;
}

function renderRoutine(routine: Routine): string {
  const line = (s: { category: string; habit: string }) => `- ${s.category} (${s.habit})`;
  return [
    'AM:', ...routine.am.map(line),
    'PM:', ...routine.pm.map(line),
  ].join('\n');
}

export function buildChatPrompt(input: PromptInput): { system: string; messages: ChatTurn[] } {
  const bandLines = DIMENSIONS.map((d) => `- ${d}: ${scoreToBand(d, input.scores[d])}`).join('\n');
  const system = [
    'You are TrueTone\'s cosmetic skincare assistant. You describe how skin LOOKS and explain a ' +
      'brand-neutral cosmetic routine. You are NOT a medical professional.',
    'Rules you MUST follow:',
    '- Describe appearance only, using everyday cosmetic language.',
    '- Only answer about THIS user\'s read and routine below. Politely decline unrelated questions.',
    '- Recommend only over-the-counter cosmetic care and habits.',
    '- DO NOT diagnose, name any skin disease, or claim to treat, cure, or prevent anything.',
    '- For any concern about a specific spot, mole, or change in the skin, tell the user to see a ' +
      'board-certified dermatologist. Never assess it yourself.',
    '',
    `This user's skin reads (appearance only):\n${bandLines}`,
    `Skin type feel: ${SKIN_TYPE_LABELS[input.skinType]}`,
    `Their current routine:\n${renderRoutine(input.routine)}`,
  ].join('\n');

  const messages: ChatTurn[] = [...input.history, { role: 'user', content: input.message }];
  return { system, messages };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/recommend/chat/__tests__/prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/chat/prompt.ts src/features/recommend/chat/__tests__/prompt.test.ts
git commit -m "feat(chat): band-label + routine prompt builder (no raw scores)"
```

---

### Task 9: Output guard (fail-closed post-filter)

**Files:**
- Create: `src/features/recommend/chat/guard.ts`
- Test: `src/features/recommend/chat/__tests__/guard.test.ts`

**Interfaces:**
- Consumes: `findDiseaseTerms` from cosmetic-filter.
- Produces: `function guardReply(text: string): { safe: string; blocked: boolean }`; `const FALLBACK_MESSAGE: string`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/recommend/chat/__tests__/guard.test.ts
import { guardReply, FALLBACK_MESSAGE } from '../guard';

test('passes through clean cosmetic replies unchanged', () => {
  const out = guardReply('The SPF step helps your skin look even over time.');
  expect(out.blocked).toBe(false);
  expect(out.safe).toContain('SPF');
});

test('fails closed on a disease term, returning the fallback', () => {
  const out = guardReply('This looks like eczema and you should treat the dermatitis.');
  expect(out.blocked).toBe(true);
  expect(out.safe).toBe(FALLBACK_MESSAGE);
});

test('fallback redirects to a dermatologist without diagnosing', () => {
  expect(FALLBACK_MESSAGE.toLowerCase()).toContain('dermatologist');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/recommend/chat/__tests__/guard.test.ts`
Expected: FAIL — cannot find module `../guard`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/recommend/chat/guard.ts
// Output-side fail-closed catch (CLAUDE.md §1): if the LLM emits any blocklisted disease/diagnostic
// term, discard its text entirely and return a safe fallback. The raw model text is NEVER shown.
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';

export const FALLBACK_MESSAGE =
  "I can only speak to how your skin looks and your cosmetic routine. For anything medical — like a " +
  'specific spot or change in your skin — please see a board-certified dermatologist.';

export function guardReply(text: string): { safe: string; blocked: boolean } {
  if (findDiseaseTerms(text).length > 0) {
    return { safe: FALLBACK_MESSAGE, blocked: true };
  }
  return { safe: text, blocked: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/recommend/chat/__tests__/guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/chat/guard.ts src/features/recommend/chat/__tests__/guard.test.ts
git commit -m "feat(chat): fail-closed output guard reusing the cosmetic filter"
```

---

### Task 10: Chat orchestration core (`handleChat`)

**Files:**
- Create: `src/features/recommend/chat/handle.ts`
- Test: `src/features/recommend/chat/__tests__/handle.test.ts`

**Interfaces:**
- Consumes: `isMedicalQuery`, `REFERRAL_MESSAGE`, `buildChatPrompt`, `ChatTurn`, `guardReply`.
- Produces:
  - `interface ScanContext { scores: ScoreVector; skinType: SkinTypeFeel; routine: Routine }`
  - `interface ChatDeps { loadScan(scanId: string): Promise<ScanContext | null>; complete(system: string, messages: ChatTurn[]): Promise<string> }`
  - `interface ChatInput { scanId: string; message: string; history: ChatTurn[] }`
  - `interface ChatOutput { reply: string; referred: boolean; blocked: boolean }`
  - `function handleChat(deps: ChatDeps, input: ChatInput): Promise<ChatOutput>`
  - Throws `Error('scan-not-found')` when `loadScan` returns null.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/recommend/chat/__tests__/handle.test.ts
import { handleChat } from '../handle';
import type { ChatDeps } from '../handle';
import type { Routine } from '../../routine-types';

const routine: Routine = { version: 'skincare-1', am: [], pm: [], notes: [] };
const ctx = {
  scores: { hydration: 0.5, oiliness: 0.5, texture: 0.5, pores: 0.5, darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5 },
  skinType: 'combination' as const, routine,
};

test('medical query short-circuits to referral and NEVER calls the LLM', async () => {
  const complete = jest.fn();
  const deps: ChatDeps = { loadScan: async () => ctx, complete };
  const out = await handleChat(deps, { scanId: 's1', message: 'is this mole cancer?', history: [] });
  expect(out.referred).toBe(true);
  expect(complete).not.toHaveBeenCalled();
});

test('a clean LLM reply is returned as-is', async () => {
  const deps: ChatDeps = { loadScan: async () => ctx, complete: async () => 'Your SPF step looks great.' };
  const out = await handleChat(deps, { scanId: 's1', message: 'why SPF?', history: [] });
  expect(out.reply).toContain('SPF');
  expect(out.blocked).toBe(false);
});

test('a disease term in the LLM reply is replaced by the fallback', async () => {
  const deps: ChatDeps = { loadScan: async () => ctx, complete: async () => 'You have eczema.' };
  const out = await handleChat(deps, { scanId: 's1', message: 'what is this?', history: [] });
  expect(out.blocked).toBe(true);
  expect(out.reply.toLowerCase()).toContain('dermatologist');
});

test('missing scan throws scan-not-found', async () => {
  const deps: ChatDeps = { loadScan: async () => null, complete: async () => 'x' };
  await expect(handleChat(deps, { scanId: 'nope', message: 'hi', history: [] })).rejects.toThrow('scan-not-found');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/recommend/chat/__tests__/handle.test.ts`
Expected: FAIL — cannot find module `../handle`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/recommend/chat/handle.ts
import type { ScoreVector, SkinTypeFeel } from '../../read/read-types';
import type { Routine } from '../routine-types';
import { isMedicalQuery, REFERRAL_MESSAGE } from './refusal';
import { buildChatPrompt, type ChatTurn } from './prompt';
import { guardReply } from './guard';

export interface ScanContext { scores: ScoreVector; skinType: SkinTypeFeel; routine: Routine }
export interface ChatDeps {
  loadScan(scanId: string): Promise<ScanContext | null>;
  complete(system: string, messages: ChatTurn[]): Promise<string>;
}
export interface ChatInput { scanId: string; message: string; history: ChatTurn[] }
export interface ChatOutput { reply: string; referred: boolean; blocked: boolean }

export async function handleChat(deps: ChatDeps, input: ChatInput): Promise<ChatOutput> {
  // Layer 2: refuse medical queries before any LLM call.
  if (isMedicalQuery(input.message)) {
    return { reply: REFERRAL_MESSAGE, referred: true, blocked: false };
  }
  // Layer 1: load the caller's own scan context (RLS enforced by the dep implementation).
  const ctx = await deps.loadScan(input.scanId);
  if (!ctx) throw new Error('scan-not-found');

  // Layer 3: constrained prompt.
  const { system, messages } = buildChatPrompt({
    scores: ctx.scores, skinType: ctx.skinType, routine: ctx.routine,
    history: input.history, message: input.message,
  });
  const raw = await deps.complete(system, messages);

  // Layer 4: fail-closed output guard.
  const { safe, blocked } = guardReply(raw);
  return { reply: safe, referred: false, blocked };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/recommend/chat/__tests__/handle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/chat/handle.ts src/features/recommend/chat/__tests__/handle.test.ts
git commit -m "feat(chat): handleChat orchestration (refuse -> load -> prompt -> guard)"
```

---

### Task 11: Edge Function shell (`routine-chat`)

**Files:**
- Create: `supabase/functions/routine-chat/index.ts`
- Create: `supabase/functions/routine-chat/deno.json` (import map for the shared pure modules)

**Interfaces:**
- Consumes: `handleChat`, `ChatDeps` from `src/features/recommend/chat/handle.ts` (pure, Deno-importable).
- This task has NO Jest test (it is the device/Deno-only network shell, like the P2 native shells). Its logic is `handleChat`, already fully tested in Task 10. Verify by `deno check` only.

> **Setup note (confirm before writing):** Supabase bundles each function with its own dependency graph. Confirm via the Supabase Edge Functions docs (Context7: `/supabase/supabase`, topic "edge functions import map / relative imports") that a relative import reaching `../../../src/...` is bundled. The shared modules (`handle.ts` and its imports `refusal/prompt/guard` + `cosmetic-filter` + `cosmetic-vocab`) are pure ESM TS with NO React/Metro/Node deps, so they bundle cleanly. If relative imports outside `supabase/functions/` are rejected by the bundler, copy the four pure files into `supabase/functions/_shared/recommend/` as the fallback and import from there (keep a comment pointing back to the src originals as the source of truth).

- [ ] **Step 1: Write the Deno handler**

```typescript
// supabase/functions/routine-chat/index.ts
// DEVICE/DENO-ONLY SHELL — the only network/LLM piece. All real logic is handleChat (Jest-tested).
// Compliance: loads ONLY the caller's derived scores+routine under RLS; never an image. Anthropic key
// is server-side only (Supabase secret). Chat is ephemeral — nothing is persisted.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { handleChat, type ChatDeps } from '../../../src/features/recommend/chat/handle.ts';
import type { ChatTurn } from '../../../src/features/recommend/chat/prompt.ts';

const MODEL = 'claude-sonnet-4-6';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('unauthorized', { status: 401 });

  // Client scoped to the caller's JWT -> RLS applies to every query.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  let body: { scanId?: string; message?: string; history?: ChatTurn[] };
  try { body = await req.json(); } catch { return new Response('bad request', { status: 400 }); }
  if (!body.scanId || !body.message) return new Response('bad request', { status: 400 });

  const deps: ChatDeps = {
    async loadScan(scanId) {
      // RLS guarantees the row belongs to the caller; a non-owned id returns no row.
      const { data } = await supabase
        .from('scans')
        .select('score_hydration,score_oiliness,score_texture,score_pores,score_dark_spots,score_redness,score_fine_lines,score_dark_circles,skin_type_feel,routine')
        .eq('id', scanId).maybeSingle();
      if (!data) return null;
      return {
        scores: {
          hydration: Number(data.score_hydration), oiliness: Number(data.score_oiliness),
          texture: Number(data.score_texture), pores: Number(data.score_pores),
          darkSpots: Number(data.score_dark_spots), redness: Number(data.score_redness),
          fineLines: Number(data.score_fine_lines), darkCircles: Number(data.score_dark_circles),
        },
        skinType: data.skin_type_feel,
        routine: data.routine,
      };
    },
    async complete(system, messages) {
      const res = await anthropic.messages.create({
        model: MODEL, max_tokens: 600, system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const block = res.content[0];
      return block && block.type === 'text' ? block.text : '';
    },
  };

  try {
    const out = await handleChat(deps, { scanId: body.scanId, message: body.message, history: body.history ?? [] });
    return Response.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    if (msg === 'scan-not-found') return new Response('not found', { status: 404 });
    return new Response('chat unavailable', { status: 502 });
  }
});
```

```json
// supabase/functions/routine-chat/deno.json
{ "imports": {} }
```

- [ ] **Step 2: Confirm the import strategy + type-check**

Run: `npx supabase functions list` is not needed; instead confirm the function type-checks:
Run: `deno check supabase/functions/routine-chat/index.ts` (if `deno` is available locally; otherwise rely on `npx supabase functions serve routine-chat --no-verify-jwt` smoke).
Expected: no type errors. If the relative `../../../src/...` import is rejected at bundle time, apply the `_shared` fallback from the setup note.

- [ ] **Step 3: Document the Anthropic secret**

Add to `README.md` (env section): `ANTHROPIC_API_KEY` must be set as a Supabase Edge Function secret (`npx supabase secrets set ANTHROPIC_API_KEY=...`) — server-side only, never in the app `.env`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/routine-chat/ README.md
git commit -m "feat(chat): routine-chat Edge Function shell over handleChat (scores-only, server-side key)"
```

---

## Phase 4 — Client UI (routine view + ephemeral chat)

### Task 12: Routine view component

**Files:**
- Create: `src/features/recommend/RoutineView.tsx`
- Test: `src/features/recommend/__tests__/RoutineView.test.tsx`

**Interfaces:**
- Consumes: `Routine` type.
- Produces: `function RoutineView({ routine }: { routine: Routine }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/recommend/__tests__/RoutineView.test.tsx
import { render, screen } from '@testing-library/react-native';
import { RoutineView } from '../RoutineView';
import type { Routine } from '../routine-types';

const routine: Routine = {
  version: 'skincare-1',
  am: [{ category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'apply every morning', rationale: 'daily habit', dimensions: [] }],
  pm: [{ category: 'a gentle exfoliant (low-strength)', habit: 'twice a week', rationale: 'for texture', dimensions: [] }],
  notes: ['Your skin reads on the drier side.'],
};

test('renders AM and PM steps and the disclaimer', () => {
  render(<RoutineView routine={routine} />);
  expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy();
  expect(screen.getByText(/gentle exfoliant/)).toBeTruthy();
  expect(screen.getByText(/looks.*not medical advice/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/recommend/__tests__/RoutineView.test.tsx`
Expected: FAIL — cannot find module `../RoutineView`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/recommend/RoutineView.tsx
import { View, Text, ScrollView } from 'react-native';
import type { Routine, RoutineStep } from './routine-types';

function Step({ step }: { step: RoutineStep }) {
  return (
    <View className="mb-3">
      <Text className="font-semibold">{step.category}</Text>
      <Text className="text-sm text-gray-600">{step.habit} — {step.rationale}</Text>
    </View>
  );
}

export function RoutineView({ routine }: { routine: Routine }) {
  return (
    <ScrollView className="p-4">
      <Text className="text-lg font-bold mb-2">Morning</Text>
      {routine.am.map((s, i) => <Step key={`am-${i}`} step={s} />)}
      <Text className="text-lg font-bold mb-2 mt-4">Evening</Text>
      {routine.pm.map((s, i) => <Step key={`pm-${i}`} step={s} />)}
      {routine.notes.map((n, i) => <Text key={`note-${i}`} className="mt-3 italic">{n}</Text>)}
      <Text className="mt-6 text-xs text-gray-500">
        This describes how your skin looks and suggests cosmetic habits — it is not medical advice.
      </Text>
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/recommend/__tests__/RoutineView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/RoutineView.tsx src/features/recommend/__tests__/RoutineView.test.tsx
git commit -m "feat(recommend): routine view with cosmetic disclaimer"
```

---

### Task 13: Chat client caller

**Files:**
- Create: `src/lib/routine-chat.ts`
- Test: `src/lib/__tests__/routine-chat.test.ts`

**Interfaces:**
- Consumes: `supabase.functions.invoke`.
- Produces:
  - `interface ChatTurn { role: 'user' | 'assistant'; content: string }`
  - `async function sendChat(scanId: string, message: string, history: ChatTurn[]): Promise<{ reply: string; referred: boolean }>`
  - Throws `Error('chat-failed')` on transport error.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/routine-chat.test.ts
import { sendChat } from '../routine-chat';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

test('sends scanId/message/history and returns the reply', async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { reply: 'hi', referred: false }, error: null });
  const out = await sendChat('s1', 'why SPF?', []);
  expect(out.reply).toBe('hi');
  const [name, opts] = (supabase.functions.invoke as jest.Mock).mock.calls[0];
  expect(name).toBe('routine-chat');
  expect(opts.body.scanId).toBe('s1');
});

test('throws chat-failed on transport error', async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error('x') });
  await expect(sendChat('s1', 'hi', [])).rejects.toThrow('chat-failed');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/routine-chat.test.ts`
Expected: FAIL — cannot find module `../routine-chat`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/routine-chat.ts
import { supabase } from './supabase';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export async function sendChat(
  scanId: string, message: string, history: ChatTurn[],
): Promise<{ reply: string; referred: boolean }> {
  const { data, error } = await supabase.functions.invoke('routine-chat', {
    body: { scanId, message, history },
  });
  if (error || !data) throw new Error('chat-failed');
  return { reply: data.reply, referred: Boolean(data.referred) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/routine-chat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routine-chat.ts src/lib/__tests__/routine-chat.test.ts
git commit -m "feat(chat): client caller for the routine-chat function"
```

---

### Task 14: Chat screen (ephemeral, scoped)

**Files:**
- Create: `src/features/recommend/ChatScreen.tsx`
- Test: `src/features/recommend/__tests__/ChatScreen.test.tsx`

**Interfaces:**
- Consumes: `sendChat`, `ChatTurn`.
- Produces: `function ChatScreen({ scanId }: { scanId: string }): JSX.Element` — holds session history in state, clears on unmount, renders states (idle/sending/error).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/recommend/__tests__/ChatScreen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ChatScreen } from '../ChatScreen';
import { sendChat } from '../../../lib/routine-chat';

jest.mock('../../../lib/routine-chat', () => ({ sendChat: jest.fn() }));

test('sends a message and shows the reply', async () => {
  (sendChat as jest.Mock).mockResolvedValue({ reply: 'The SPF step helps.', referred: false });
  render(<ChatScreen scanId="s1" />);
  fireEvent.changeText(screen.getByPlaceholderText(/ask about your routine/i), 'why SPF?');
  fireEvent.press(screen.getByText(/send/i));
  await waitFor(() => expect(screen.getByText('The SPF step helps.')).toBeTruthy());
});

test('shows a graceful error when the call fails', async () => {
  (sendChat as jest.Mock).mockRejectedValue(new Error('chat-failed'));
  render(<ChatScreen scanId="s1" />);
  fireEvent.changeText(screen.getByPlaceholderText(/ask about your routine/i), 'hi');
  fireEvent.press(screen.getByText(/send/i));
  await waitFor(() => expect(screen.getByText(/couldn.t load/i)).toBeTruthy());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/recommend/__tests__/ChatScreen.test.tsx`
Expected: FAIL — cannot find module `../ChatScreen`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/recommend/ChatScreen.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { sendChat, type ChatTurn } from '../../lib/routine-chat';

export function ChatScreen({ scanId }: { scanId: string }) {
  const [history, setHistory] = useState<ChatTurn[]>([]); // session-only; cleared on unmount
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSend() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true); setError(false);
    const nextHistory: ChatTurn[] = [...history, { role: 'user', content: message }];
    setHistory(nextHistory); setInput('');
    try {
      const { reply } = await sendChat(scanId, message, history);
      setHistory([...nextHistory, { role: 'assistant', content: reply }]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 p-4">
      <ScrollView className="flex-1">
        {history.map((m, i) => (
          <Text key={i} className={m.role === 'user' ? 'text-right mb-2' : 'mb-2'}>{m.content}</Text>
        ))}
        {error && <Text className="text-red-600">Couldn't load a reply right now — please try again.</Text>}
      </ScrollView>
      <View className="flex-row items-center mt-2">
        <TextInput
          className="flex-1 border rounded px-3 py-2"
          placeholder="Ask about your routine"
          value={input}
          onChangeText={setInput}
        />
        <Pressable onPress={onSend} className="ml-2 px-4 py-2 bg-black rounded">
          <Text className="text-white">Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/recommend/__tests__/ChatScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/ChatScreen.tsx src/features/recommend/__tests__/ChatScreen.test.tsx
git commit -m "feat(chat): ephemeral scoped chat screen"
```

---

### Task 15: Route wiring + final verification

**Files:**
- Create: `app/scan/routine.tsx`
- Test: `app/__tests__/routine-route.test.tsx`

**Interfaces:**
- Consumes: `fetchLatestScan` (or a passed `scanId`), `RoutineView`, `ChatScreen`.
- Produces: the `/scan/routine` route showing the latest scan's routine + chat entry point.

- [ ] **Step 1: Write the failing test**

```tsx
// app/__tests__/routine-route.test.tsx
import { render, screen, waitFor } from '@testing-library/react-native';
import RoutineRoute from '../scan/routine';
import { fetchLatestScan } from '../../src/lib/scans';

jest.mock('../../src/lib/scans', () => ({ fetchLatestScan: jest.fn() }));

test('renders the latest scan routine', async () => {
  (fetchLatestScan as jest.Mock).mockResolvedValue({
    id: 's1', capturedAt: '2026-06-18', skinType: 'dry',
    scores: {}, modelVersion: 'stub-1', isStub: true,
    routine: { version: 'skincare-1', am: [{ category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'am', rationale: 'r', dimensions: [] }], pm: [], notes: [] },
  });
  render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/__tests__/routine-route.test.tsx`
Expected: FAIL — cannot find module `../scan/routine`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// app/scan/routine.tsx
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { fetchLatestScan, type Scan } from '../../src/lib/scans';
import { RoutineView } from '../../src/features/recommend/RoutineView';

export default function RoutineRoute() {
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestScan().then(setScan).finally(() => setLoading(false));
  }, []);

  if (loading) return <View><Text>Loading…</Text></View>;
  if (!scan) return <View><Text>No scan yet — run a scan to see your routine.</Text></View>;
  return <RoutineView routine={scan.routine} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/__tests__/routine-route.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification + commit**

Run all gates:
```bash
npm test                    # full Jest suite, coverage thresholds hold
npx supabase test db        # pgTAP suites (run if local Supabase is up)
npm run check:compliance    # no analytics/ad SDK
npm run check:no-egress     # no image path
npx tsc --noEmit            # type-check
```
Expected: all green.

```bash
git add app/scan/routine.tsx app/__tests__/routine-route.test.tsx
git commit -m "feat(recommend): /scan/routine route + final verification"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §2 architecture / module map → Tasks 1–4 (engine), 7–11 (chat), 5–6 (persistence), 12–15 (UI). ✓
- §2.2 makeup-ready seam → Task 1 (`RecommendationDomain`). ✓
- §3 data model (routine on scans, atomic write, shape validation, retention inheritance) → Task 5; client write → Task 6. ✓
- §4 guardrail layers: scores-only context (Task 11 `loadScan`), input refusal (Task 7/10), system prompt (Task 8), fail-closed post-filter (Task 9/10) → ✓.
- §4.3 vendor-disclosure launch-blocker → carried in Global Constraints + spec; not a code task (correct). ✓
- §5 UI (routine view + ephemeral chat + states) → Tasks 12, 14; route → Task 15. ✓
- §6 testing (pure unit, edge-fn mocked LLM, SQL/RLS/retention, compliance guards) → every task is TDD; Task 5 SQL; Task 15 runs all gates. ✓

**Placeholder scan:** no TBD/TODO; every code step has complete code. The one runtime-confirm (Supabase relative-import bundling) has an explicit fallback. ✓

**Type consistency:** `Routine`/`RoutineStep`/`RecommendationAttrs` defined Task 1, used consistently; `ChatTurn` defined in `prompt.ts` (Task 8), re-imported by handle/client; `record_scan` 6-arg signature consistent between Task 5 (SQL) and Task 6 (client call); `recordScan(r)` keeps its single-arg shape (routine built internally). ✓

**Out of scope (spec §8):** no makeup, no branded products, no general Q&A, no chat persistence, no trend loop — none introduced. ✓
