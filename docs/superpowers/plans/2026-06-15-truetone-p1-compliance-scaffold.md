# TrueTone P1 Compliance Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Expo + Supabase compliance scaffold (18+ gate, BIPA consent + logging, data-rights, versioned policies, US-only geo, no-analytics-SDK guard) so the camera (P2) can slot in behind it without retrofit.

**Architecture:** DB-core-first (Approach A). Postgres holds the compliance guarantees (RLS + `SECURITY DEFINER` RPCs + `pg_cron`); the Expo app is a thin, fail-closed client gated by a routing guard. Anonymous-first auth gives a stable user id from launch. Deletion keeps a de-identified consent receipt.

**Tech Stack:** Expo SDK 56, Expo Router, NativeWind, TypeScript, `@supabase/supabase-js` v2, Supabase CLI (local Postgres via Docker), pgTAP (`supabase test db`), Jest (`jest-expo`) + `@testing-library/react-native`.

**Source spec:** `docs/superpowers/specs/2026-06-15-truetone-p1-compliance-scaffold-design.md`

**Conventions:** TDD (RED→GREEN→REFACTOR), 80%+ coverage, frequent commits. Compliance invariants are must-pass regardless of coverage. Workers in Phase 3 own ONE feature dir and never touch `/supabase/**` or `/src/lib/**`.

---

## Deviations from this plan made during Phase 0–1 (authoritative — follow these)

These were discovered/decided during implementation. Where they conflict with task code below,
**these win**; later phases and worktree workers must follow them.

**Environment / setup (Phase 0):**
- Added `.npmrc` with `legacy-peer-deps=true` (Expo Router 56's tree has a react/react-dom peer
  mismatch). All `npm install` (incl. worktrees) rely on this.
- `tailwindcss` pinned to `^3.4.17` (NativeWind 4 needs Tailwind 3, not the v4 that auto-installs).
- `jest` pinned to `^29` (jest-expo 56 is built on the jest-29 ecosystem; jest 30 caused
  `clearMocksOnScope` runtime skew). `@types/jest` ^29 to match.
- Extra deps required for the toolchain to run: `@react-native/jest-preset`, `babel-preset-expo`,
  `react-native-reanimated`, `react-native-worklets` (NativeWind/RN 0.85 babel + Metro need them).
- Local Supabase emits the new `sb_publishable_…`/`sb_secret_…` keys, but `npx supabase status`
  still prints a legacy `ANON_KEY` JWT — use that for `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- No local `psql`; query the DB via `docker exec <supabase_db_*> psql -U postgres -tAc "…"`.

**Schema / DB (Phase 1):**
- `policy_versions` PK is **composite `(version, doc_key)`** (the original single-column `version`
  PK breaks the seed that shares one version across five docs). One-current-per-doc enforced by a
  partial unique index.
- `consent_log` gained **`policy_doc_key text not null default 'biometric'`** + a **composite FK**
  `(policy_version, policy_doc_key) → policy_versions(version, doc_key)` (security-review #3: a BIPA
  receipt must reference a real, specific policy). All RPCs pin `policy_doc_key='biometric'`.
- Immutability (`0003`): the trigger blocks DELETE and all UPDATEs **except `user_id → null`**
  de-identification. RPCs therefore do a **plain `UPDATE … set user_id = null`** — no
  `session_replication_role = replica` (which needs superuser and is fragile on hosted Supabase).
- `FORCE ROW LEVEL SECURITY` intentionally **not** used (would subject the `SECURITY DEFINER`
  retention sweep to RLS and break cross-user purge; clients are never table owners).
- pgTAP tests must account for the **seeded** policies — don't insert a second `is_current`
  biometric row (collides with the partial unique index); reference the seeded `'2026-06-15.1'`.
- Added pgTAP guards asserting RLS is enabled on `profiles`/`consent_log` (regression guard).
- Verify de-identified rows (`user_id null`) as a privileged role in tests — RLS hides them from
  the authenticated caller (`reset role;` before such assertions).

## File Structure

```
/app
  _layout.tsx                  Root layout: providers + routing guard mount
  index.tsx                    Onboarding/Home (standing disclaimer; scan locked)
  age-gate.tsx                 Age Gate route
  consent.tsx                  Consent route
  policies/index.tsx           Policy list
  policies/[doc].tsx           Policy reader
  data/index.tsx               "Your Data" (withdraw/delete/account)
  region-blocked.tsx           Not-available-in-region screen
/src
  /lib
    supabase.ts                Supabase client singleton
    auth.ts                    Anonymous-auth bootstrap + profile fetch/create
    profile-context.tsx        React context: session + profile + refresh
    routing-guard.ts           Pure gate-decision function (region→18+→consent)
    region.ts                  Coarse US region check
  /features
    age-gate/age.ts            Pure age computation (no DOB persisted)
    age-gate/AgeGate.tsx       Age gate screen component
    consent/consent-copy.ts    Versioned consent disclosures (what/purpose/retention)
    consent/Consent.tsx        Consent screen component
    data-rights/DataRights.tsx "Your Data" screen component
    policies/PolicyList.tsx    Policy list component
    policies/PolicyReader.tsx  Policy reader component
    onboarding/Onboarding.tsx  Home + standing disclaimer
  /content
    manifest.ts                Single source of policy versions (seeds DB too)
    privacy.md terms.md biometric.md retention.md wa_health.md
/supabase
  /migrations
    0001_schema.sql 0002_rls.sql 0003_consent_immutability.sql
    0004_rpcs.sql 0005_retention_cron.sql 0006_seed_policies.sql
  /tests
    schema.test.sql rls_isolation.test.sql consent_immutable.test.sql
    rpc_consent.test.sql rpc_delete.test.sql retention.test.sql
/scripts
  check-no-analytics-sdk.mjs   CI guard (package.json + lockfile + Expo config)
/test
  setup.ts                     Jest/RNTL setup
```

---

# PHASE 0 — Foundation (control center, no subagent)

### Task 0.1: Scaffold the Expo app

**Files:** creates the Expo project in-place.

- [ ] **Step 1: Create the app**

Run from repo root (the dir already has `CLAUDE.md`, `data/`, `docs/`):
```bash
npx create-expo-app@latest . --template blank-typescript
```
If it refuses because the dir isn't empty, scaffold in a temp dir and move files in:
```bash
npx create-expo-app@latest /tmp/tt --template blank-typescript && \
  cp -R /tmp/tt/. . && rm -rf /tmp/tt
```

- [ ] **Step 2: Add Expo Router, NativeWind, Supabase, test deps**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-localization
npm install nativewind tailwindcss @supabase/supabase-js react-native-url-polyfill @react-native-async-storage/async-storage
npm install -D jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest
```

- [ ] **Step 3: Set entry point + scheme in `package.json`**

Set `"main": "expo-router/entry"` and add `"scheme": "truetone"` under an `expo` key in `app.json` (create `app.json` if missing) with `"name": "TrueTone"`, `"slug": "truetone"`.

- [ ] **Step 4: Verify it boots**

Run: `npx expo start --no-dev --offline` then quit (Ctrl+C). Expected: bundler starts with no resolution errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Expo app with Router, NativeWind, Supabase deps"
```

### Task 0.2: Configure NativeWind + Jest

**Files:**
- Create: `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `global.css`, `nativewind-env.d.ts`
- Create: `jest.config.js`, `test/setup.ts`

- [ ] **Step 1: Tailwind + Babel + Metro + global.css**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
};
```
`babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
```
`metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });
```
`global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
`nativewind-env.d.ts`:
```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 2: Jest config + setup**

`jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect', './test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|@supabase/.*))',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
  coverageThreshold: { global: { lines: 80, statements: 80, branches: 70, functions: 80 } },
};
```
`test/setup.ts`:
```ts
import '@testing-library/jest-native/extend-expect';
```
Add scripts to `package.json`: `"test": "jest", "test:watch": "jest --watch", "test:coverage": "jest --coverage"`.

- [ ] **Step 3: Smoke test proves the harness runs**

`test/smoke.test.ts`:
```ts
test('jest harness runs', () => {
  expect(1 + 1).toBe(2);
});
```
Run: `npm test -- test/smoke.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: configure NativeWind and Jest test harness"
```

### Task 0.3: Initialize local Supabase

**Files:** creates `supabase/` config.

- [ ] **Step 1: Init + start**

```bash
npx supabase init
npx supabase start
```
Expected: prints API URL (`http://127.0.0.1:54321`), DB URL, and an `anon key`. Docker must be running.

- [ ] **Step 2: Enable anonymous sign-ins locally**

In `supabase/config.toml`, under `[auth]` set `enable_anonymous_sign_ins = true`. Then `npx supabase stop && npx supabase start` to apply.

- [ ] **Step 3: Verify pgTAP runner works**

`supabase/tests/_sanity.test.sql`:
```sql
begin;
select plan(1);
select ok(true, 'pgTAP runs');
select * from finish();
rollback;
```
Run: `npx supabase test db`
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: init local Supabase with anonymous auth + pgTAP sanity"
```

---

# PHASE 1 — DB compliance core (1 subagent, sequential)

> Worker brief: this is the critical path. Write pgTAP RED first, then migrations to GREEN. After each task run `npx supabase db reset` (re-applies all migrations) then `npx supabase test db`.

### Task 1.1: Schema

**Files:**
- Create: `supabase/migrations/0001_schema.sql`
- Test: `supabase/tests/schema.test.sql`

- [ ] **Step 1: Failing test**

`supabase/tests/schema.test.sql`:
```sql
begin;
select plan(6);
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'consent_log', 'consent_log exists');
select has_table('public', 'policy_versions', 'policy_versions exists');
select has_table('public', 'retention_runs', 'retention_runs exists');
select col_is_pk('public', 'profiles', 'id', 'profiles pk is id');
select hasnt_column('public', 'profiles', 'dob', 'profiles never stores dob');
select * from finish();
rollback;
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx supabase test db`
Expected: FAIL (tables do not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0001_schema.sql`:
```sql
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_18_plus boolean not null default false,
  age_verified_at timestamptz,
  consent_active boolean not null default false,
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.policy_versions (
  version text primary key,
  doc_key text not null check (doc_key in ('privacy','terms','biometric','retention','wa_health')),
  effective_at timestamptz not null default now(),
  is_current boolean not null default false
);
create unique index policy_versions_current_per_doc
  on public.policy_versions (doc_key) where is_current;

create type consent_action as enum ('consented','withdrawn','deleted');

create table public.consent_log (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid not null default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action consent_action not null,
  policy_version text not null references public.policy_versions(version),
  created_at timestamptz not null default now()
);
create index consent_log_user_idx on public.consent_log(user_id);

create table public.retention_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  purged_count int not null default 0
);
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx supabase db reset && npx supabase test db`
Expected: schema.test.sql 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/ && git commit -m "feat(db): compliance core schema (profiles, consent_log, policy_versions, retention_runs)"
```

### Task 1.2: Row-Level Security

**Files:**
- Create: `supabase/migrations/0002_rls.sql`
- Test: `supabase/tests/rls_isolation.test.sql`

- [ ] **Step 1: Failing test** (uses two fake auth uids; asserts cross-user reads return 0 rows)

`supabase/tests/rls_isolation.test.sql`:
```sql
begin;
select plan(3);

-- seed a current policy + two users' profiles as the privileged role
insert into public.policy_versions(version, doc_key, is_current) values ('v-test','biometric', true);
insert into auth.users(id) values ('11111111-1111-1111-1111-111111111111');
insert into auth.users(id) values ('22222222-2222-2222-2222-222222222222');
insert into public.profiles(id) values ('11111111-1111-1111-1111-111111111111');
insert into public.profiles(id) values ('22222222-2222-2222-2222-222222222222');

-- act as user 1
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222')::int,
  0, 'user1 cannot read user2 profile');
select is(
  (select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111')::int,
  1, 'user1 can read own profile');
select is(
  (select count(*) from public.policy_versions)::int, 1, 'policy_versions world-readable');

select * from finish();
rollback;
```

- [ ] **Step 2: Run, expect FAIL** (RLS not enabled → user1 sees user2)

Run: `npx supabase test db`
Expected: FAIL on first assertion.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0002_rls.sql`:
```sql
alter table public.profiles enable row level security;
alter table public.consent_log enable row level security;
alter table public.policy_versions enable row level security;
alter table public.retention_runs enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

create policy consent_select_own on public.consent_log
  for select using (user_id = auth.uid());
create policy consent_insert_own on public.consent_log
  for insert with check (user_id = auth.uid());
-- no update/delete policies => denied for all non-privileged roles

create policy policy_versions_read_all on public.policy_versions
  for select using (true);
-- retention_runs: no policies => not client-readable
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx supabase db reset && npx supabase test db`
Expected: rls_isolation 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/ && git commit -m "feat(db): RLS per-user isolation, world-readable policies"
```

### Task 1.3: Consent-log immutability

**Files:**
- Create: `supabase/migrations/0003_consent_immutability.sql`
- Test: `supabase/tests/consent_immutable.test.sql`

- [ ] **Step 1: Failing test** (update and delete must raise)

`supabase/tests/consent_immutable.test.sql`:
```sql
begin;
select plan(2);
insert into public.policy_versions(version, doc_key, is_current) values ('v-test','biometric', true);
insert into auth.users(id) values ('33333333-3333-3333-3333-333333333333');
insert into public.profiles(id) values ('33333333-3333-3333-3333-333333333333');
insert into public.consent_log(user_id, action, policy_version)
  values ('33333333-3333-3333-3333-333333333333','consented','v-test');

select throws_ok(
  $$ update public.consent_log set action = 'withdrawn' $$,
  'P0001', 'consent_log is append-only', 'update blocked');
select throws_ok(
  $$ delete from public.consent_log $$,
  'P0001', 'consent_log is append-only', 'delete blocked');
select * from finish();
rollback;
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx supabase test db`
Expected: FAIL (no trigger yet).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0003_consent_immutability.sql`:
```sql
create or replace function public.block_consent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'consent_log is append-only' using errcode = 'P0001';
end;
$$;

create trigger consent_log_no_update
  before update on public.consent_log
  for each row execute function public.block_consent_mutation();
create trigger consent_log_no_delete
  before delete on public.consent_log
  for each row execute function public.block_consent_mutation();
```
Note: the deletion RPC must NULL `user_id` via a path that bypasses this. We allow that by having the RPC temporarily disable the trigger within its transaction (see Task 1.5) OR by excluding `user_id`-only updates. Chosen approach: the RPC uses `set local session_replication_role = replica;` to bypass triggers inside the `SECURITY DEFINER` function.

- [ ] **Step 4: Run, expect PASS**

Run: `npx supabase db reset && npx supabase test db`
Expected: consent_immutable 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/ && git commit -m "feat(db): consent_log append-only immutability triggers"
```

### Task 1.4: Seed policies + content manifest single-source

**Files:**
- Create: `supabase/migrations/0006_seed_policies.sql` (numbered 0006 to run after RPCs; safe either way)
- Create: `src/content/manifest.ts` and the five `.md` files

- [ ] **Step 1: Author the manifest (single source of versions)**

`src/content/manifest.ts`:
```ts
export const POLICY_VERSION = '2026-06-15.1';
export type DocKey = 'privacy' | 'terms' | 'biometric' | 'retention' | 'wa_health';
export const POLICY_DOCS: { key: DocKey; title: string }[] = [
  { key: 'privacy', title: 'Privacy Policy' },
  { key: 'terms', title: 'Terms of Use' },
  { key: 'biometric', title: 'Biometric Data Policy' },
  { key: 'retention', title: 'Data Retention Schedule' },
  { key: 'wa_health', title: 'WA Consumer Health Data Policy' },
];
```
Create the five `src/content/*.md` files using the spec §8 copy-paste blocks as PLACEHOLDER text, each starting with: `> PLACEHOLDER — pending counsel review.` The `biometric.md` MUST contain the what/purpose/retention disclosures (BIPA §15(b)).

- [ ] **Step 2: Seed migration mirrors the manifest version**

`supabase/migrations/0006_seed_policies.sql`:
```sql
insert into public.policy_versions(version, doc_key, is_current) values
  ('2026-06-15.1','privacy', true),
  ('2026-06-15.1','terms', true),
  ('2026-06-15.1','biometric', true),
  ('2026-06-15.1','retention', true),
  ('2026-06-15.1','wa_health', true)
on conflict (version) do nothing;
```

- [ ] **Step 3: Apply + verify**

Run: `npx supabase db reset` then:
```bash
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "select count(*) from public.policy_versions where is_current;"
```
Expected: `5`.

- [ ] **Step 4: Commit**

```bash
git add supabase/ src/content/ && git commit -m "feat(db): seed current policy versions from content manifest"
```

### Task 1.5: Compliance RPCs

**Files:**
- Create: `supabase/migrations/0004_rpcs.sql`
- Test: `supabase/tests/rpc_consent.test.sql`, `supabase/tests/rpc_delete.test.sql`

- [ ] **Step 1: Failing tests**

`supabase/tests/rpc_consent.test.sql`:
```sql
begin;
select plan(4);
insert into public.policy_versions(version, doc_key, is_current) values ('2026-06-15.1','biometric', true);
insert into auth.users(id) values ('44444444-4444-4444-4444-444444444444');
insert into public.profiles(id) values ('44444444-4444-4444-4444-444444444444');

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select lives_ok($$ select public.record_consent() $$, 'record_consent runs');
select is((select consent_active from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  true, 'consent_active set true');
select is((select policy_version from public.consent_log where action='consented' limit 1),
  '2026-06-15.1', 'logged current policy version');
-- idempotent: second call does not create a 2nd active-consent duplicate
select public.record_consent();
select is((select count(*) from public.consent_log where action='consented')::int, 1, 'idempotent re-consent');
select * from finish();
rollback;
```
`supabase/tests/rpc_delete.test.sql`:
```sql
begin;
select plan(3);
insert into public.policy_versions(version, doc_key, is_current) values ('2026-06-15.1','biometric', true);
insert into auth.users(id) values ('55555555-5555-5555-5555-555555555555');
insert into public.profiles(id, is_18_plus, age_verified_at) values ('55555555-5555-5555-5555-555555555555', true, now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select public.record_consent();
select public.delete_my_data();

select is((select is_18_plus from public.profiles where id='55555555-5555-5555-5555-555555555555'),
  false, 'delete_my_data clears derived data');
select is((select count(*) from public.consent_log where action='deleted')::int, 1, 'deletion logged');
select is((select count(*) from public.consent_log where user_id is null)::int >= 1, true,
  'prior consent rows de-identified (user_id null)');
select * from finish();
rollback;
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx supabase test db`
Expected: FAIL (functions undefined).

- [ ] **Step 3: Write the RPCs**

`supabase/migrations/0004_rpcs.sql`:
```sql
-- record_consent: idempotent; pins server-side current biometric policy version
create or replace function public.record_consent()
returns public.consent_log
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_version text;
        v_row public.consent_log;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select version into v_version from public.policy_versions where doc_key='biometric' and is_current;
  if v_version is null then raise exception 'no current biometric policy' using errcode='P0001'; end if;

  if exists (select 1 from public.profiles where id=v_uid and consent_active) then
    update public.profiles set last_interaction_at=now() where id=v_uid;
    select * into v_row from public.consent_log where user_id=v_uid and action='consented'
      order by created_at desc limit 1;
    return v_row;
  end if;

  insert into public.consent_log(user_id, action, policy_version)
    values (v_uid, 'consented', v_version) returning * into v_row;
  update public.profiles set consent_active=true, last_interaction_at=now() where id=v_uid;
  return v_row;
end; $$;

create or replace function public.withdraw_consent()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_version text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select version into v_version from public.policy_versions where doc_key='biometric' and is_current;
  insert into public.consent_log(user_id, action, policy_version) values (v_uid,'withdrawn',v_version);
  update public.profiles set consent_active=false, last_interaction_at=now() where id=v_uid;
end; $$;

create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_version text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select version into v_version from public.policy_versions where doc_key='biometric' and is_current;
  insert into public.consent_log(user_id, action, policy_version) values (v_uid,'deleted',v_version);
  -- de-identify prior consent rows (bypass append-only trigger inside definer scope)
  set local session_replication_role = replica;
  update public.consent_log set user_id = null where user_id = v_uid;
  set local session_replication_role = default;
  -- reset derived data to minimal stub; keep account alive
  update public.profiles
     set is_18_plus=false, age_verified_at=null, consent_active=false, last_interaction_at=now()
   where id=v_uid;
end; $$;

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  perform public.delete_my_data();
  delete from public.profiles where id=v_uid;       -- cascades nothing biometric in P1
  delete from auth.users where id=v_uid;            -- full account teardown
end; $$;

revoke all on function public.record_consent() from public;
revoke all on function public.withdraw_consent() from public;
revoke all on function public.delete_my_data() from public;
revoke all on function public.delete_account() from public;
grant execute on function public.record_consent() to authenticated;
grant execute on function public.withdraw_consent() to authenticated;
grant execute on function public.delete_my_data() to authenticated;
grant execute on function public.delete_account() to authenticated;
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx supabase db reset && npx supabase test db`
Expected: rpc_consent 4/4 and rpc_delete 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/ && git commit -m "feat(db): record/withdraw consent + delete_my_data/delete_account RPCs"
```

### Task 1.6: Retention sweep + cron

**Files:**
- Create: `supabase/migrations/0005_retention_cron.sql`
- Test: `supabase/tests/retention.test.sql`

- [ ] **Step 1: Failing test** (the sweep purges only >3yr-inactive users; logs a run)

`supabase/tests/retention.test.sql`:
```sql
begin;
select plan(3);
insert into public.policy_versions(version, doc_key, is_current) values ('2026-06-15.1','biometric', true);
insert into auth.users(id) values ('66666666-6666-6666-6666-666666666666'); -- stale
insert into auth.users(id) values ('77777777-7777-7777-7777-777777777777'); -- active
insert into public.profiles(id, last_interaction_at) values
  ('66666666-6666-6666-6666-666666666666', now() - interval '4 years'),
  ('77777777-7777-7777-7777-777777777777', now());

select public.truetone_retention_sweep();

select is((select count(*) from public.profiles where id='66666666-6666-6666-6666-666666666666')::int,
  0, 'stale user purged');
select is((select count(*) from public.profiles where id='77777777-7777-7777-7777-777777777777')::int,
  1, 'active user kept');
select is((select count(*) from public.retention_runs)::int, 1, 'run logged');
select * from finish();
rollback;
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx supabase test db`
Expected: FAIL (function undefined).

- [ ] **Step 3: Write the migration**

`supabase/migrations/0005_retention_cron.sql`:
```sql
create extension if not exists pg_cron;

create or replace function public.truetone_retention_sweep()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_count int := 0; v_version text;
begin
  select version into v_version from public.policy_versions where doc_key='biometric' and is_current;
  for v_id in
    select id from public.profiles where last_interaction_at < now() - interval '3 years'
  loop
    insert into public.consent_log(user_id, action, policy_version) values (v_id,'deleted',v_version);
    set local session_replication_role = replica;
    update public.consent_log set user_id = null where user_id = v_id;
    set local session_replication_role = default;
    delete from public.profiles where id = v_id;
    delete from auth.users where id = v_id;
    v_count := v_count + 1;
  end loop;
  insert into public.retention_runs(purged_count) values (v_count);
end; $$;

select cron.schedule('truetone-retention', '0 3 * * *',
  $$ select public.truetone_retention_sweep(); $$);
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx supabase db reset && npx supabase test db`
Expected: retention 3/3 pass; full suite green.

- [ ] **Step 5: Commit**

```bash
git add supabase/ && git commit -m "feat(db): retention sweep + nightly pg_cron schedule"
```

---

# PHASE 2 — App shell + routing guard (1 subagent)

> Freezes `/src/lib`. After this, Phase 3 workers are unblocked.

### Task 2.1: Supabase client + env

**Files:**
- Create: `src/lib/supabase.ts`, `.env.example`
- Test: `src/lib/__tests__/supabase.test.ts`

- [ ] **Step 1: Failing test**

`src/lib/__tests__/supabase.test.ts`:
```ts
import { supabase } from '../supabase';
test('supabase client exposes auth + rpc', () => {
  expect(supabase.auth).toBeDefined();
  expect(typeof supabase.rpc).toBe('function');
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test -- src/lib/__tests__/supabase.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=replace-with-local-anon-key
```
`src/lib/supabase.ts`:
```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(url, anonKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
```
Copy `.env.example` → `.env` and paste the local anon key from `npx supabase status`.

- [ ] **Step 4: Run, expect PASS**

Run: `npm test -- src/lib/__tests__/supabase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ .env.example && git commit -m "feat(lib): supabase client singleton"
```

### Task 2.2: Anonymous-auth bootstrap + profile

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/__tests__/auth.test.ts`

- [ ] **Step 1: Failing test** (mock supabase; bootstrap signs in anonymously when no session)

`src/lib/__tests__/auth.test.ts`:
```ts
import { bootstrapSession } from '../auth';

const signInAnonymously = jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
const getSession = jest.fn().mockResolvedValue({ data: { session: null }, error: null });
const upsert = jest.fn().mockResolvedValue({ error: null });
jest.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: () => getSession(), signInAnonymously: () => signInAnonymously() },
    from: () => ({ upsert: (...a: unknown[]) => upsert(...a) }),
  },
}));

test('creates anonymous session when none exists', async () => {
  await bootstrapSession();
  expect(signInAnonymously).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test -- src/lib/__tests__/auth.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/auth.ts`:
```ts
import { supabase } from './supabase';

export async function bootstrapSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  let userId = data.session?.user?.id;
  if (!userId) {
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error || !anon.user) throw new Error('auth-bootstrap-failed');
    userId = anon.user.id;
  }
  // ensure a profile row exists + bump last_interaction_at
  await supabase.from('profiles').upsert(
    { id: userId, last_interaction_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  return userId;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm test -- src/lib/__tests__/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ && git commit -m "feat(lib): anonymous-auth bootstrap + profile ensure"
```

### Task 2.3: Region check + routing guard (pure)

**Files:**
- Create: `src/lib/region.ts`, `src/lib/routing-guard.ts`
- Test: `src/lib/__tests__/routing-guard.test.ts`

- [ ] **Step 1: Failing test** (pure decision function: region→18+→consent, fail-closed)

`src/lib/__tests__/routing-guard.test.ts`:
```ts
import { nextRoute } from '../routing-guard';

test('non-US blocks to region screen', () => {
  expect(nextRoute({ isUS: false, is18: true, consent: true })).toBe('region-blocked');
});
test('unknown region fails closed to region screen', () => {
  expect(nextRoute({ isUS: null, is18: true, consent: true })).toBe('region-blocked');
});
test('US but not 18 -> age gate', () => {
  expect(nextRoute({ isUS: true, is18: false, consent: false })).toBe('age-gate');
});
test('US + 18 but no consent -> consent', () => {
  expect(nextRoute({ isUS: true, is18: true, consent: false })).toBe('consent');
});
test('all pass -> home', () => {
  expect(nextRoute({ isUS: true, is18: true, consent: true })).toBe('home');
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test -- src/lib/__tests__/routing-guard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/region.ts`:
```ts
import * as Localization from 'expo-localization';

// Coarse, no precise location. Returns null when undeterminable (caller fails closed).
export function isUSRegion(): boolean | null {
  const region = Localization.getLocales?.()[0]?.regionCode ?? null;
  if (region == null) return null;
  return region === 'US';
}
```
`src/lib/routing-guard.ts`:
```ts
export type GateState = { isUS: boolean | null; is18: boolean; consent: boolean };
export type Route = 'region-blocked' | 'age-gate' | 'consent' | 'home';

export function nextRoute(s: GateState): Route {
  if (s.isUS !== true) return 'region-blocked'; // fail closed on false OR null
  if (!s.is18) return 'age-gate';
  if (!s.consent) return 'consent';
  return 'home';
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npm test -- src/lib/__tests__/routing-guard.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Build the profile context + wire the guard in `app/_layout.tsx`**

`src/lib/profile-context.tsx`:
```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { bootstrapSession } from './auth';
import { isUSRegion } from './region';
import { nextRoute, type Route } from './routing-guard';

type Profile = { is_18_plus: boolean; consent_active: boolean };
type Ctx = { loading: boolean; error: boolean; route: Route; refresh: () => Promise<void> };
const ProfileContext = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [route, setRoute] = useState<Route>('region-blocked');

  async function refresh() {
    try {
      setError(false);
      const uid = await bootstrapSession();
      const { data, error: e } = await supabase
        .from('profiles').select('is_18_plus, consent_active').eq('id', uid).single();
      if (e || !data) throw new Error('profile-load-failed');
      const p = data as Profile;
      setRoute(nextRoute({ isUS: isUSRegion(), is18: p.is_18_plus, consent: p.consent_active }));
    } catch {
      setError(true); // fail closed: never advance on unknown identity
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);
  return <ProfileContext.Provider value={{ loading, error, route, refresh }}>{children}</ProfileContext.Provider>;
}
export function useProfile() {
  const c = useContext(ProfileContext);
  if (!c) throw new Error('useProfile outside provider');
  return c;
}
```
`app/_layout.tsx`:
```tsx
import '../global.css';
import { Stack, Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { ProfileProvider, useProfile } from '../src/lib/profile-context';

function Guard() {
  const { loading, error, route } = useProfile();
  if (loading) return <View className="flex-1 items-center justify-center"><Text>Loading…</Text></View>;
  if (error) return <View className="flex-1 items-center justify-center"><Text>Connection problem. Pull to retry.</Text></View>;
  if (route === 'region-blocked') return <Redirect href="/region-blocked" />;
  if (route === 'age-gate') return <Redirect href="/age-gate" />;
  if (route === 'consent') return <Redirect href="/consent" />;
  return <Stack screenOptions={{ headerShown: true }} />;
}
export default function RootLayout() {
  return <ProfileProvider><Guard /></ProfileProvider>;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/ app/ && git commit -m "feat(lib): region check, routing guard, profile context, root layout gate"
```

---

# PHASE 3 — Screen slices (3 parallel worktree subagents)

> Each worker owns ONE feature dir + its route. Do NOT touch `/supabase/**` or `/src/lib/**`.
> Setup per worker: `git worktree add ../TrueTone-3X -b phase3X-...` then `cd` and run Claude.

## Task 3a: Age Gate

**Files:**
- Create: `src/features/age-gate/age.ts`, `src/features/age-gate/AgeGate.tsx`, `app/age-gate.tsx`
- Test: `src/features/age-gate/__tests__/age.test.ts`, `.../AgeGate.test.tsx`

- [ ] **Step 1: Failing unit test — pure age math, no DOB stored**

`src/features/age-gate/__tests__/age.test.ts`:
```ts
import { computeIs18Plus } from '../age';
test('exactly 18 today passes', () => {
  const d = new Date(); d.setFullYear(d.getFullYear() - 18);
  expect(computeIs18Plus(d, new Date())).toBe(true);
});
test('one day under 18 fails', () => {
  const now = new Date('2026-06-15');
  const dob = new Date('2008-06-16');
  expect(computeIs18Plus(dob, now)).toBe(false);
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test -- src/features/age-gate/__tests__/age.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement pure function**

`src/features/age-gate/age.ts`:
```ts
export function computeIs18Plus(dob: Date, now: Date): boolean {
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 18;
}
```

- [ ] **Step 4: Run, expect PASS** — `npm test -- src/features/age-gate/__tests__/age.test.ts`

- [ ] **Step 5: Failing component test — DOB never persisted/logged**

`src/features/age-gate/__tests__/AgeGate.test.tsx`:
```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AgeGate } from '../AgeGate';

const update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
jest.mock('../../../lib/supabase', () => ({ supabase: { from: () => ({ update }) } }));
const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

test('passes 18+ by writing only the derived flag; no DOB in any call/log', async () => {
  const { getByTestId } = render(<AgeGate userId="u1" onPass={jest.fn()} />);
  fireEvent.changeText(getByTestId('dob-input'), '2000-01-01');
  fireEvent.press(getByTestId('dob-submit'));
  await waitFor(() => expect(update).toHaveBeenCalled());
  const payload = JSON.stringify(update.mock.calls);
  expect(payload).toContain('is_18_plus');
  expect(payload).not.toContain('2000-01-01'); // DOB never sent
  expect(JSON.stringify(logSpy.mock.calls)).not.toContain('2000-01-01'); // never logged
});
```

- [ ] **Step 6: Run, expect FAIL** — `npm test -- src/features/age-gate/__tests__/AgeGate.test.tsx`

- [ ] **Step 7: Implement the screen**

`src/features/age-gate/AgeGate.tsx`:
```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';
import { computeIs18Plus } from './age';

export function AgeGate({ userId, onPass }: { userId: string; onPass: () => void }) {
  const [value, setValue] = useState('');
  const [blocked, setBlocked] = useState(false);
  async function submit() {
    const dob = new Date(value);
    if (isNaN(dob.getTime())) { setBlocked(false); return; }
    if (!computeIs18Plus(dob, new Date())) { setBlocked(true); return; } // discard DOB
    await supabase.from('profiles')
      .update({ is_18_plus: true, age_verified_at: new Date().toISOString() })
      .eq('id', userId);
    onPass();
  }
  if (blocked) return <View className="flex-1 items-center justify-center p-6"><Text>TrueTone is available to adults 18 and over.</Text></View>;
  return (
    <View className="flex-1 justify-center p-6 gap-4">
      <Text className="text-lg font-semibold">Enter your date of birth</Text>
      <TextInput testID="dob-input" placeholder="YYYY-MM-DD" value={value} onChangeText={setValue}
        className="border rounded p-3" autoCapitalize="none" />
      <Pressable testID="dob-submit" onPress={submit} className="bg-black rounded p-3">
        <Text className="text-white text-center">Continue</Text>
      </Pressable>
    </View>
  );
}
```
`app/age-gate.tsx`: render `<AgeGate>` wiring `userId` from session and `onPass` → `refresh()` from `useProfile()`.

- [ ] **Step 8: Run, expect PASS** — `npm test -- src/features/age-gate`

- [ ] **Step 9: Commit** — `git add -A && git commit -m "feat(age-gate): 18+ gate, derived flag only, DOB never persisted"`

## Task 3b: Consent

**Files:**
- Create: `src/features/consent/consent-copy.ts`, `src/features/consent/Consent.tsx`, `app/consent.tsx`
- Test: `src/features/consent/__tests__/Consent.test.tsx`

- [ ] **Step 1: Failing test — §15(b) disclosures present; button disabled until checked; calls record_consent**

`src/features/consent/__tests__/Consent.test.tsx`:
```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Consent } from '../Consent';

const rpc = jest.fn().mockResolvedValue({ data: {}, error: null });
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

test('renders BIPA 15(b) disclosures (what/purpose/retention)', () => {
  const { getByText } = render(<Consent onConsent={jest.fn()} onDecline={jest.fn()} />);
  expect(getByText(/biometric/i)).toBeTruthy();   // WHAT
  expect(getByText(/purpose/i)).toBeTruthy();      // PURPOSE
  expect(getByText(/3 years|retention/i)).toBeTruthy(); // RETENTION
});
test('consent button disabled until box checked, then calls record_consent', async () => {
  const onConsent = jest.fn();
  const { getByTestId } = render(<Consent onConsent={onConsent} onDecline={jest.fn()} />);
  const btn = getByTestId('consent-submit');
  expect(btn).toBeDisabled();
  fireEvent.press(getByTestId('consent-check'));
  expect(btn).not.toBeDisabled();
  fireEvent.press(btn);
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('record_consent'));
  expect(onConsent).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test -- src/features/consent`

- [ ] **Step 3: Implement copy + screen**

`src/features/consent/consent-copy.ts`:
```ts
// Mirrors spec §8 biometric consent block — PLACEHOLDER pending counsel review.
// MUST satisfy BIPA §15(b) (what/purpose/retention) AND WA MHMDA consent.
export const CONSENT_COPY = {
  title: 'Before we scan your skin',
  what: 'TrueTone captures a photo of your face and measures visible features of your skin (a "biometric identifier" under laws like Illinois’ BIPA).',
  purpose: 'Purpose: to estimate your skin’s appearance and suggest a cosmetic routine.',
  retention: 'We delete it when its purpose is met or within 3 years of your last use, whichever comes first — and anytime you tap "Delete My Data."',
  checkbox: 'I have read the Biometric Data Policy and consent to TrueTone collecting and storing my biometric data as described.',
};
```
`src/features/consent/Consent.tsx`:
```tsx
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';
import { CONSENT_COPY as C } from './consent-copy';

export function Consent({ onConsent, onDecline }: { onConsent: () => void; onDecline: () => void }) {
  const [checked, setChecked] = useState(false);
  async function consent() {
    const { error } = await supabase.rpc('record_consent');
    if (!error) onConsent();
  }
  return (
    <View className="flex-1 p-6 gap-3">
      <Text className="text-xl font-bold">{C.title}</Text>
      <Text>{C.what}</Text>
      <Text>{C.purpose}</Text>
      <Text>{C.retention}</Text>
      <Pressable testID="consent-check" onPress={() => setChecked((v) => !v)}>
        <Text>{checked ? '☑' : '☐'} {C.checkbox}</Text>
      </Pressable>
      <View className="flex-row gap-3 mt-4">
        <Pressable onPress={onDecline} className="flex-1 border rounded p-3"><Text className="text-center">Decline</Text></Pressable>
        <Pressable testID="consent-submit" disabled={!checked} onPress={consent}
          accessibilityState={{ disabled: !checked }}
          className={`flex-1 rounded p-3 ${checked ? 'bg-black' : 'bg-gray-300'}`}>
          <Text className="text-white text-center">I Consent</Text>
        </Pressable>
      </View>
    </View>
  );
}
```
`app/consent.tsx`: render `<Consent>` with `onConsent` → `refresh()`, `onDecline` → stay (camera locked).

- [ ] **Step 4: Run, expect PASS** — `npm test -- src/features/consent`

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(consent): BIPA 15(b)+MHMDA consent, no pre-check, disabled-until-checked"`

## Task 3c: Your Data + Policies + Onboarding disclaimer

**Files:**
- Create: `src/features/data-rights/DataRights.tsx`, `app/data/index.tsx`; `src/features/policies/PolicyList.tsx`, `PolicyReader.tsx`, `app/policies/index.tsx`, `app/policies/[doc].tsx`; `src/features/onboarding/Onboarding.tsx`, `app/index.tsx`, `app/region-blocked.tsx`
- Test: `src/features/data-rights/__tests__/DataRights.test.tsx`, `src/features/onboarding/__tests__/Onboarding.test.tsx`, `src/features/policies/__tests__/PolicyList.test.tsx`

- [ ] **Step 1: Failing tests**

`src/features/onboarding/__tests__/Onboarding.test.tsx`:
```tsx
import { render } from '@testing-library/react-native';
import { Onboarding } from '../Onboarding';
test('shows not-a-medical-device disclaimer, no efficacy/equity claim', () => {
  const { getByText, queryByText } = render(<Onboarding />);
  expect(getByText(/not a medical device/i)).toBeTruthy();
  expect(getByText(/dermatologist/i)).toBeTruthy();
  expect(queryByText(/clinically proven|validated across|dermatologist-level/i)).toBeNull();
});
```
`src/features/data-rights/__tests__/DataRights.test.tsx`:
```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DataRights } from '../DataRights';
const rpc = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
test('withdraw/delete/account call correct RPCs after confirm', async () => {
  const { getByTestId } = render(<DataRights onChanged={jest.fn()} confirm={async () => true} />);
  fireEvent.press(getByTestId('withdraw'));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('withdraw_consent'));
  fireEvent.press(getByTestId('delete-data'));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('delete_my_data'));
  fireEvent.press(getByTestId('delete-account'));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('delete_account'));
});
```
`src/features/policies/__tests__/PolicyList.test.tsx`:
```tsx
import { render } from '@testing-library/react-native';
import { PolicyList } from '../PolicyList';
test('lists all five policy docs', () => {
  const { getByText } = render(<PolicyList onOpen={jest.fn()} />);
  ['Privacy Policy','Terms of Use','Biometric Data Policy','Data Retention Schedule','WA Consumer Health Data Policy']
    .forEach((t) => expect(getByText(t)).toBeTruthy());
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test -- src/features/data-rights src/features/onboarding src/features/policies`

- [ ] **Step 3: Implement components**

`src/features/onboarding/Onboarding.tsx`:
```tsx
import { View, Text } from 'react-native';
export function Onboarding() {
  return (
    <View className="flex-1 p-6 gap-4 justify-center">
      <Text className="text-2xl font-bold">TrueTone</Text>
      <Text className="text-xs text-gray-600">
        TrueTone is a cosmetic and general-wellness tool. It is not a medical device, does not
        diagnose, treat, or prevent any disease or condition, and is not a substitute for
        professional medical advice. Results are AI-generated estimates of your skin’s appearance.
        For any skin concern — or any new, changing, or unusual spot — please consult a
        board-certified dermatologist.
      </Text>
    </View>
  );
}
```
`src/features/data-rights/DataRights.tsx`:
```tsx
import { View, Text, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';
type Props = { onChanged: () => void; confirm: (msg: string) => Promise<boolean> };
export function DataRights({ onChanged, confirm }: Props) {
  async function run(fn: 'withdraw_consent' | 'delete_my_data' | 'delete_account', msg: string) {
    if (!(await confirm(msg))) return;
    const { error } = await supabase.rpc(fn);
    if (!error) onChanged();
  }
  return (
    <View className="flex-1 p-6 gap-3">
      <Text className="text-lg font-semibold">Your Data</Text>
      <Pressable testID="withdraw" onPress={() => run('withdraw_consent', 'Withdraw consent?')} className="border rounded p-3"><Text>Withdraw Consent</Text></Pressable>
      <Pressable testID="delete-data" onPress={() => run('delete_my_data', 'Delete all your data?')} className="border rounded p-3"><Text>Delete My Data</Text></Pressable>
      <Pressable testID="delete-account" onPress={() => run('delete_account', 'Delete your account permanently?')} className="border rounded p-3"><Text>Delete Account</Text></Pressable>
    </View>
  );
}
```
`src/features/policies/PolicyList.tsx`:
```tsx
import { View, Text, Pressable } from 'react-native';
import { POLICY_DOCS, type DocKey } from '../../content/manifest';
export function PolicyList({ onOpen }: { onOpen: (k: DocKey) => void }) {
  return (
    <View className="flex-1 p-6 gap-2">
      {POLICY_DOCS.map((d) => (
        <Pressable key={d.key} onPress={() => onOpen(d.key)} className="border rounded p-3">
          <Text>{d.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```
To avoid configuring a Metro Markdown transformer, store policy bodies as TS strings (single source, no extra build config). Create `src/content/bodies.ts`:
```ts
import type { DocKey } from './manifest';
// PLACEHOLDER bodies pending counsel review. biometric MUST keep what/purpose/retention (BIPA §15(b)).
export const POLICY_BODIES: Record<DocKey, string> = {
  privacy: '> PLACEHOLDER — Privacy Policy pending counsel review.',
  terms: '> PLACEHOLDER — Terms pending counsel review.',
  biometric: '> PLACEHOLDER — Biometric Data Policy pending counsel review.\n\nWhat we collect: a photo of your face and visible skin features (a biometric identifier).\nPurpose: estimate skin appearance and suggest a cosmetic routine.\nRetention: deleted when purpose is met or within 3 years of last use, whichever is first.',
  retention: '> PLACEHOLDER — Retention Schedule pending counsel review.',
  wa_health: '> PLACEHOLDER — WA Consumer Health Data Policy pending counsel review.',
};
```
(The `.md` files under `/src/content` remain the canonical text counsel edits; keep them in sync with `bodies.ts`, or later swap to a Metro `.md` transformer.)
`src/features/policies/PolicyReader.tsx`:
```tsx
import { ScrollView, Text } from 'react-native';
import { POLICY_BODIES } from '../../content/bodies';
import type { DocKey } from '../../content/manifest';
export function PolicyReader({ docKey }: { docKey: DocKey }) {
  return <ScrollView className="flex-1 p-6"><Text>{POLICY_BODIES[docKey]}</Text></ScrollView>;
}
```
Create the matching `app/` route files wiring these components (`app/index.tsx` → `Onboarding`, `app/data/index.tsx` → `DataRights` with an `Alert`-based `confirm`, `app/policies/index.tsx` → `PolicyList`, `app/policies/[doc].tsx` → `PolicyReader`, `app/region-blocked.tsx` → simple message).

- [ ] **Step 4: Run, expect PASS** — `npm test -- src/features/data-rights src/features/onboarding src/features/policies`

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(data-rights+policies+onboarding): screens, disclaimer, 5 policies"`

---

# PHASE 4 — CI guardrail + integration (1 subagent, control center)

### Task 4.1: No-analytics-SDK build guard

**Files:**
- Create: `scripts/check-no-analytics-sdk.mjs`, `.github/workflows/compliance.yml`
- Test: `scripts/__tests__/check-no-analytics-sdk.test.mjs`

- [ ] **Step 1: Failing test**

`scripts/__tests__/check-no-analytics-sdk.test.mjs`:
```js
import { findForbidden } from '../check-no-analytics-sdk.mjs';
test('flags forbidden SDKs anywhere in dependency text', () => {
  const hits = findForbidden('{"dependencies":{"@react-native-firebase/analytics":"1.0.0"}}');
  expect(hits).toContain('@react-native-firebase/analytics');
});
test('clean manifest yields no hits', () => {
  expect(findForbidden('{"dependencies":{"expo-router":"1.0.0"}}')).toHaveLength(0);
});
```

- [ ] **Step 2: Run, expect FAIL** — `node --test scripts/__tests__/check-no-analytics-sdk.test.mjs`

- [ ] **Step 3: Implement**

`scripts/check-no-analytics-sdk.mjs`:
```js
import { readFileSync, existsSync } from 'node:fs';

const FORBIDDEN = [
  '@react-native-firebase/analytics', 'firebase/analytics',
  'react-native-fbsdk', 'react-native-fbsdk-next', 'expo-facebook',
  '@segment/', 'react-native-google-mobile-ads', 'react-native-appsflyer',
  'amplitude', 'mixpanel', 'react-native-branch',
];
export function findForbidden(text) {
  return FORBIDDEN.filter((f) => text.includes(f));
}
function scan() {
  const files = ['package.json', 'package-lock.json', 'app.json', 'app.config.js', 'app.config.ts'];
  const blob = files.filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
  const hits = findForbidden(blob);
  if (hits.length) { console.error('FORBIDDEN analytics/ad SDK detected:', hits); process.exit(1); }
  console.log('compliance: no forbidden analytics/ad SDKs found');
}
if (import.meta.url === `file://${process.argv[1]}`) scan();
```
Add to `package.json`: `"check:compliance": "node scripts/check-no-analytics-sdk.mjs"`.
`.github/workflows/compliance.yml`:
```yaml
name: compliance
on: [push, pull_request]
jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run check:compliance
      - run: npm test
```

- [ ] **Step 4: Run, expect PASS** — `node --test scripts/__tests__/check-no-analytics-sdk.test.mjs && npm run check:compliance`

- [ ] **Step 5: Commit** — `git add -A && git commit -m "ci: fail build on any ad/analytics SDK (pkg + lockfile + Expo config)"`

### Task 4.2: Integration test — bootstrap → gate → unlock

**Files:**
- Test: `src/lib/__tests__/integration.test.ts` (runs against local Supabase)

- [ ] **Step 1: Write the integration test**

`src/lib/__tests__/integration.test.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

test('anon user: gate locked until 18+ AND consent, then home', async () => {
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: anon } = await sb.auth.signInAnonymously();
  const uid = anon.user!.id;
  await sb.from('profiles').upsert({ id: uid });

  let { data: p } = await sb.from('profiles').select('is_18_plus,consent_active').eq('id', uid).single();
  expect(p!.is_18_plus).toBe(false);

  await sb.from('profiles').update({ is_18_plus: true, age_verified_at: new Date().toISOString() }).eq('id', uid);
  await sb.rpc('record_consent');

  ({ data: p } = await sb.from('profiles').select('is_18_plus,consent_active').eq('id', uid).single());
  expect(p!.is_18_plus).toBe(true);
  expect(p!.consent_active).toBe(true);

  await sb.rpc('delete_account');
});
```

- [ ] **Step 2: Run against local Supabase**

Run: `npx supabase start && npm test -- src/lib/__tests__/integration.test.ts`
Expected: PASS (full gate path works end-to-end).

- [ ] **Step 3: Commit** — `git add -A && git commit -m "test: end-to-end bootstrap→gate→consent→unlock integration"`

---

## Final verification (control center, after all merges)

- [ ] `npx supabase db reset && npx supabase test db` — all pgTAP green.
- [ ] `npm run check:compliance` — passes.
- [ ] `npm run test:coverage` — 80%+; compliance invariant tests all pass.
- [ ] Manual smoke in Expo Go: region→age→consent→home; Your Data withdraw/delete/account; policies reachable.
- [ ] Confirm no raw image code, no camera, no analytics SDK anywhere (P1 boundary intact).
