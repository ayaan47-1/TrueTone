# Waitlist Phone Capture + SMS Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect an optional US phone number plus TCPA-compliant SMS consent on the waitlist, storing consent proof that survives unsubscribe — without building any sending capability.

**Architecture:** Four columns on the existing `waitlist` table hold the live state; an append-only `waitlist_sms_events` table holds grant/revoke receipts keyed by an HMAC of the number rather than the number itself, so a receipt outlives the phone number it refers to. Anon reaches all of it through one `security definer` RPC that returns `void`, preserving the existing non-enumeration guarantee. The browser never transmits a number unless the SMS box is ticked.

**Tech Stack:** Postgres 15 (Supabase, `us-east-2`), pgTAP, pgcrypto, vanilla ES modules for the static site in `web/`, `node --test` for JS.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-07-waitlist-sms-design.md`. Read it before Task 1.
- **Branch:** `feat/waitlist-sms`, currently one commit ahead of `main`.
- **Scope:** capture only. **Do not** add Twilio, any SMS or email vendor, an Edge Function, a STOP webhook, an RND check, or a quiet-hours scheduler. `sms_invited_at` and the `sent` event type are seams — nothing writes them.
- **No new dependencies.** `web/` must stay buildable with no `node_modules` and no Python (font subsets are committed). No package may be added to `package.json`.
- **Canonical disclosure string, ASCII-only, byte-for-byte identical in all three homes** (`src/content/sms-consent.js`, migration `0016`, the rendered page):
  `Text me when TrueTone launches. ~1-2 messages. Msg & data rates may apply. Reply STOP to opt out. Consent isn't required to join.`
  No en-dashes, no curly apostrophes: non-GSM-7 characters force SMS into UCS-2 (160 → 70 chars per segment) and break the drift test.
- **Consent version string:** `sms-2026-08-07` (matches the spec; do **not** re-date it to the implementation date).
- **Every RPC returns `void`.** A response that varies by outcome turns the form into an oracle for whether an address or number is on the list.
- **Compliance:** this stores an email, a phone number, and an attestation. No face image, no scan, no score. It stays outside the `CLAUDE.md` §3 boundary. Do not add IP or user-agent capture — that was explicitly declined.
- **Migration numbering:** `0016_waitlist_sms.sql`. Do not edit `0014` or `0015`.
- **Commands:** `npx supabase test db` (pgTAP, needs Docker running), `npm run test:scripts` (node), `npm run check:compliance` (copy gate).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0016_waitlist_sms.sql` | Create — all schema, helper functions, RPC replacement, trigger, retention arm |
| `supabase/tests/waitlist_sms.test.sql` | Create — pgTAP for everything in `0016`. Kept separate from `waitlist.test.sql` so the existing 20-assertion plan is untouched |
| `src/content/sms-consent.js` | Create — the canonical disclosure string and version, single source of truth |
| `test/content/sms-consent.test.mjs` | Create — asserts the migration and the page both carry the canonical string byte-for-byte |
| `web/waitlist-client.js` | Modify — add `parsePhone`, `SMS_CONSENT_VERSION`; change `buildRequest` signature |
| `test/web/waitlist-client.test.mjs` | Modify — rewrite `buildRequest` specs, add `parsePhone` specs |
| `web/index.html` | Modify — phone input + consent checkbox |
| `web/app.js` | Modify — read, validate, and submit the new fields |
| `web/styles.css` | Modify — style the optional-field hint |
| `scripts/check-waitlist-copy.mjs` | Modify — require TCPA disclosures on any page with a `tel` input |
| `scripts/__tests__/check-waitlist-copy.test.mjs` | Modify — cover the four new disclosure rules |
| `src/content/privacy.md`, `src/content/retention.md` | Modify — phone and consent-receipt retention |

**Dependency order:** Tasks 1–4 are SQL and strictly sequential. Task 5 is independent. Task 6 depends on 5. Task 7 depends on 5 and 6.

---

### Task 1: Migration 0016 — schema, secrets, and append-only triggers

**Files:**
- Create: `supabase/migrations/0016_waitlist_sms.sql`
- Test: `supabase/tests/waitlist_sms.test.sql`

**Interfaces:**
- Consumes: `public.waitlist` from `0014_waitlist.sql`; `pgcrypto` from `0001_schema.sql:1`.
- Produces: tables `public.waitlist_sms_consent_versions(version text pk, body text, created_at timestamptz)`, `public.waitlist_sms_events(id uuid pk, phone_hash text, pepper_version smallint, event text, consent_version text, created_at timestamptz)`, `public.waitlist_secrets(name text pk, value text)`; columns `waitlist.phone`, `waitlist.sms_consent_at`, `waitlist.sms_consent_version`, `waitlist.sms_invited_at`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/waitlist_sms.test.sql`:

```sql
-- supabase/tests/waitlist_sms.test.sql
-- pgTAP coverage for 0016_waitlist_sms: phone capture and TCPA consent proof.
--
-- The waitlist holds an email address and now a phone number — never biometric or skin
-- data. It stays outside the compliance boundary in CLAUDE.md §3. Retention still applies.
begin;
select plan(14);

-- ── shape ─────────────────────────────────────────────────────────────────────
select has_column('public', 'waitlist', 'phone', 'waitlist carries a phone column');
select has_column('public', 'waitlist', 'sms_consent_at', 'waitlist records when SMS consent was given');
select has_column('public', 'waitlist', 'sms_consent_version', 'waitlist records which wording was consented to');
select has_column('public', 'waitlist', 'sms_invited_at', 'waitlist has the send-project idempotency seam');
select has_table('public', 'waitlist_sms_events', 'the consent event log exists');
select has_table('public', 'waitlist_sms_consent_versions', 'the consent wording table exists');
select has_table('public', 'waitlist_secrets', 'the pepper table exists');

-- ── no client role may read any of it ─────────────────────────────────────────
select table_privs_are('public', 'waitlist_sms_events', 'anon', '{}',
  'anon holds no privileges on the event log');
select table_privs_are('public', 'waitlist_secrets', 'service_role', '{}',
  'even service_role cannot read the pepper');

-- ── phone format: E.164 US, excluding N11 service codes ───────────────────────
select throws_ok(
  $$ insert into public.waitlist(email, attested_18_us, phone, sms_consent_at, sms_consent_version)
     values ('a@example.com', true, '+19115550100', now(), 'sms-2026-08-07') $$,
  '23514', null, '911 is rejected as an area code');
select throws_ok(
  $$ insert into public.waitlist(email, attested_18_us, phone, sms_consent_at, sms_consent_version)
     values ('b@example.com', true, '+12124115100', now(), 'sms-2026-08-07') $$,
  '23514', null, '411 is rejected as an exchange');

-- ── a number and its consent record are inseparable ───────────────────────────
select throws_ok(
  $$ insert into public.waitlist(email, attested_18_us, phone)
     values ('c@example.com', true, '+12125550100') $$,
  '23514', null, 'a phone with no consent record is rejected');

-- ── the event log is append-only ──────────────────────────────────────────────
insert into public.waitlist_sms_events(phone_hash, event) values ('deadbeef', 'granted');
select throws_ok(
  $$ update public.waitlist_sms_events set event = 'revoked' where phone_hash = 'deadbeef' $$,
  'P0001', null, 'the event log cannot be updated');
select throws_ok(
  $$ delete from public.waitlist_sms_events where phone_hash = 'deadbeef' $$,
  'P0001', null, 'the event log cannot be deleted from');

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Docker must be running first (`open -a Docker`, then `npx supabase start`).

Run: `npx supabase test db`
Expected: FAIL — `relation "public.waitlist_sms_events" does not exist`.

- [ ] **Step 3: Write minimal implementation**

Create `supabase/migrations/0016_waitlist_sms.sql`:

```sql
-- supabase/migrations/0016_waitlist_sms.sql
-- Optional phone capture + TCPA consent proof for the pre-launch waitlist.
--
-- CAN-SPAM governs the email list; TCPA governs texts, and it is a different animal:
-- $500-$1,500 per message, uncapped, with a private right of action. Marketing texts need
-- prior express written consent — a clear disclosure plus an affirmative act specific to
-- SMS — so this migration stores not just the number but proof of what was agreed and when.
--
-- Nothing here sends anything. sms_invited_at and the 'sent' event type are seams for a
-- later project; no code writes them yet.

-- ── live state on the waitlist row ────────────────────────────────────────────
alter table public.waitlist
  add column phone               text,
  add column sms_consent_at      timestamptz,
  add column sms_consent_version text,
  add column sms_invited_at      timestamptz;

-- E.164, US only. A plain ^\+1[2-9][0-9]{2}[2-9][0-9]{6}$ would accept +19115550100:
-- N11 codes are assignable as neither area code nor exchange, so exclude them explicitly.
alter table public.waitlist add constraint waitlist_phone_e164 check (
  phone is null or (
    phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
    and substring(phone from 3 for 3) !~ '^[2-9]11$'
    and substring(phone from 6 for 3) !~ '^[2-9]11$'
  )
);

-- A stored number and a consent record are inseparable: there is no path to a textable
-- number with no proof behind it.
alter table public.waitlist add constraint waitlist_phone_consent_paired
  check (num_nonnulls(phone, sms_consent_at, sms_consent_version) in (0, 3));

-- Partial: many rows have no phone, but no number is ever stored twice.
create unique index waitlist_phone_key on public.waitlist(phone) where phone is not null;

-- ── the exact wording that was consented to ───────────────────────────────────
-- Kept in the database, not only in the repo, so it is reconstructable from a dump alone —
-- which is the artifact that would actually be handed to counsel.
create table public.waitlist_sms_consent_versions (
  version    text primary key,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ASCII only. A curly apostrophe or en-dash here breaks the byte-for-byte drift test and
-- forces any SMS carrying this text into UCS-2 (160 -> 70 characters per segment).
insert into public.waitlist_sms_consent_versions(version, body) values (
  'sms-2026-08-07',
  'Text me when TrueTone launches. ~1-2 messages. Msg & data rates may apply. Reply STOP to opt out. Consent isn''t required to join.'
);

alter table public.waitlist add constraint waitlist_sms_consent_version_fk
  foreign key (sms_consent_version) references public.waitlist_sms_consent_versions(version);

revoke all on public.waitlist_sms_consent_versions from anon, authenticated, service_role;
grant select on public.waitlist_sms_consent_versions to service_role;

-- ── the pepper ────────────────────────────────────────────────────────────────
-- Generated here rather than deployed by hand: a pepper that must be set manually after
-- deploy is one that will eventually be missing, at which point join_waitlist either
-- breaks signups or silently skips the log.
--
-- No grants to anyone. Only the table owner can read it, which is exactly what a
-- security-definer function runs as. Supabase Vault would add encryption at rest, but it
-- buys nothing against the threat this defends: anyone holding a full dump already has
-- waitlist.phone in plaintext. This defends a leak of the event log on its own.
create table public.waitlist_secrets (
  name  text primary key,
  value text not null
);
alter table public.waitlist_secrets enable row level security;
revoke all on public.waitlist_secrets from anon, authenticated, service_role;

insert into public.waitlist_secrets(name, value)
values ('sms_pepper', encode(gen_random_bytes(32), 'hex'));

-- ── the consent event log ─────────────────────────────────────────────────────
-- Survives unsubscribe and holds no phone number, so an opt-out does not erase the proof
-- that consent existed. Given a claimant's number you can hash it and find the receipt.
create table public.waitlist_sms_events (
  id              uuid primary key default gen_random_uuid(),
  phone_hash      text     not null,
  -- so a rotated (or wrongly restored) pepper does not silently render every existing
  -- hash unverifiable at exactly the moment they are needed
  pepper_version  smallint not null default 1,
  event           text     not null check (event in ('granted', 'revoked', 'sent')),
  consent_version text,
  created_at      timestamptz not null default now()
);
create index waitlist_sms_events_hash_idx on public.waitlist_sms_events(phone_hash);

revoke all on public.waitlist_sms_events from anon, authenticated, service_role;
grant select on public.waitlist_sms_events to service_role;

-- Append-only, and stricter than consent_log: there is no identity to null out, so both
-- UPDATE and DELETE always raise. The single exception is waitlist_retention_sweep(),
-- which sets app.waitlist_sweep for the duration of its transaction (see 0016 below).
create or replace function public.block_waitlist_sms_event_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('app.waitlist_sweep', true), '') = 'on' then
    return old;
  end if;
  raise exception 'waitlist_sms_events is append-only' using errcode = 'P0001';
end;
$$;

create trigger waitlist_sms_events_no_update
  before update on public.waitlist_sms_events
  for each row execute function public.block_waitlist_sms_event_mutation();
create trigger waitlist_sms_events_no_delete
  before delete on public.waitlist_sms_events
  for each row execute function public.block_waitlist_sms_event_mutation();

-- The wording is a legal record too.
create or replace function public.block_consent_version_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'waitlist_sms_consent_versions is append-only' using errcode = 'P0001';
end;
$$;

create trigger waitlist_sms_consent_versions_no_update
  before update on public.waitlist_sms_consent_versions
  for each row execute function public.block_consent_version_mutation();
create trigger waitlist_sms_consent_versions_no_delete
  before delete on public.waitlist_sms_consent_versions
  for each row execute function public.block_consent_version_mutation();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS, 14 assertions in `waitlist_sms.test.sql`, and all pre-existing suites still green.

`db reset` matters: `retention.test.sql` asserts `count(*) from retention_runs = 1` and a long-lived local database accumulates rows from the nightly `pg_cron` job, producing a failure unrelated to your change.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0016_waitlist_sms.sql supabase/tests/waitlist_sms.test.sql
git commit -m "feat(waitlist): schema for phone capture and SMS consent proof"
```

---

### Task 2: Phone normalization and hashing helpers

**Files:**
- Modify: `supabase/migrations/0016_waitlist_sms.sql` (append)
- Test: `supabase/tests/waitlist_sms.test.sql` (extend)

**Interfaces:**
- Consumes: `public.waitlist_secrets` from Task 1; `extensions.hmac` from pgcrypto.
- Produces: `public.normalize_us_phone(p_raw text) returns text` (E.164 or `null`), `public.waitlist_phone_hash(p_phone text) returns text` (hex sha256 HMAC).

- [ ] **Step 1: Write the failing test**

In `supabase/tests/waitlist_sms.test.sql`, change `select plan(14);` to `select plan(20);` and insert before `select * from finish();`:

```sql
-- ── normalization ─────────────────────────────────────────────────────────────
select is(public.normalize_us_phone('(212) 555-0100'), '+12125550100',
  'punctuation and spaces are stripped');
select is(public.normalize_us_phone('12125550100'), '+12125550100',
  'a leading 1 is read as the country code, not a digit');
select is(public.normalize_us_phone('+1 212 555 0100'), '+12125550100',
  'an already-E.164 number round-trips');
select is(public.normalize_us_phone('212555010'), null,
  'nine digits is not a US number');
select is(public.normalize_us_phone('+442071838750'), null,
  'a non-US number is rejected rather than mangled');

-- ── hashing ───────────────────────────────────────────────────────────────────
-- Two spellings of one number must land on the same hash or dedup and lookup both break.
select is(
  public.waitlist_phone_hash(public.normalize_us_phone('(212) 555-0100')),
  public.waitlist_phone_hash(public.normalize_us_phone('212.555.0100')),
  'the same number in two formats hashes identically');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — `function public.normalize_us_phone(unknown) does not exist`.

- [ ] **Step 3: Write minimal implementation**

Append to `supabase/migrations/0016_waitlist_sms.sql`:

```sql
-- ── helpers ───────────────────────────────────────────────────────────────────
-- Normalising server-side rather than trusting the browser: otherwise dedup depends on
-- the client having done its job, and a client that did not normalise gets a confusing
-- rejection from the CHECK constraint. The constraint is the backstop, not the enforcement.
create or replace function public.normalize_us_phone(p_raw text)
returns text
language plpgsql immutable
as $$
declare v_digits text;
begin
  if p_raw is null then return null; end if;
  v_digits := regexp_replace(p_raw, '[^0-9]', '', 'g');
  -- 11 digits starting with 1 means the country code was included
  if length(v_digits) = 11 and left(v_digits, 1) = '1' then
    v_digits := substring(v_digits from 2);
  end if;
  if length(v_digits) <> 10 then return null; end if;
  return '+1' || v_digits;
end;
$$;

-- security definer so it can read waitlist_secrets, which has no grants at all.
create or replace function public.waitlist_phone_hash(p_phone text)
returns text
language plpgsql
security definer set search_path = public, extensions, pg_temp
as $$
declare v_pepper text;
begin
  select value into v_pepper from public.waitlist_secrets where name = 'sms_pepper';
  if v_pepper is null then
    -- Fail loudly. Hashing with an empty pepper would produce brute-forceable digests
    -- that look identical to good ones.
    raise exception 'waitlist sms pepper missing' using errcode = 'P0001';
  end if;
  return encode(extensions.hmac(p_phone, v_pepper, 'sha256'), 'hex');
end;
$$;

revoke all on function public.normalize_us_phone(text) from public;
revoke all on function public.waitlist_phone_hash(text) from public;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS, 20 assertions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0016_waitlist_sms.sql supabase/tests/waitlist_sms.test.sql
git commit -m "feat(waitlist): server-side phone normalization and peppered hashing"
```

---

### Task 3: Replace `join_waitlist`

**Files:**
- Modify: `supabase/migrations/0016_waitlist_sms.sql` (append)
- Test: `supabase/tests/waitlist_sms.test.sql` (extend)

**Interfaces:**
- Consumes: `normalize_us_phone`, `waitlist_phone_hash` from Task 2.
- Produces: `public.join_waitlist(p_email text, p_attested boolean, p_phone text default null, p_sms_consent boolean default false, p_sms_consent_version text default null) returns void`. The two-argument form from `0014` is dropped.

**Critical:** this is a `drop` + `create`, not an overload. Two candidate signatures make PostgREST answer `PGRST203` for a two-key call instead of choosing, which would break the live form.

- [ ] **Step 1: Write the failing test**

Change `select plan(20);` to `select plan(37);` and insert before `select * from finish();`:

```sql
-- ── join_waitlist: the old 2-arg form must be gone, not shadowed ──────────────
-- Two candidate signatures make PostgREST answer PGRST203 rather than picking one.
select is(
  (select count(*)::int from pg_proc where proname = 'join_waitlist'),
  1, 'exactly one join_waitlist signature exists');

-- A cached copy of the old page sends two keys and must still work via defaults.
select lives_ok(
  $$ select public.join_waitlist('legacy@example.com', true) $$,
  'a two-argument call still joins, so a stale cached page keeps working');
select is((select phone from public.waitlist where email = 'legacy@example.com'), null,
  'a two-argument call stores no phone');

-- ── consent gates the number ──────────────────────────────────────────────────
-- A typo'd or unconsented number must not cost the visitor their email signup.
select lives_ok(
  $$ select public.join_waitlist('nobox@example.com', true, '(212) 555-0101', false, null) $$,
  'a number with the box unticked does not fail the signup');
select is((select phone from public.waitlist where email = 'nobox@example.com'), null,
  'a number with the box unticked is discarded');

-- ── the happy path ────────────────────────────────────────────────────────────
select lives_ok(
  $$ select public.join_waitlist('ok@example.com', true, '(212) 555-0102', true, 'sms-2026-08-07') $$,
  'a consented number is accepted');
select is((select phone from public.waitlist where email = 'ok@example.com'), '+12125550102',
  'the number is stored normalized');
select is(
  (select count(*)::int from public.waitlist_sms_events
   where phone_hash = public.waitlist_phone_hash('+12125550102') and event = 'granted'),
  1, 'a grant receipt is written');

-- ── a number already on the list under another address ────────────────────────
-- Must not error: an error would confirm the number is present. The email joins alone.
select lives_ok(
  $$ select public.join_waitlist('dupe@example.com', true, '212-555-0102', true, 'sms-2026-08-07') $$,
  'a number already on the list does not surface an error');
select is((select phone from public.waitlist where email = 'dupe@example.com'), null,
  'the duplicate number is discarded, the email still joins');
select is(
  (select count(*)::int from public.waitlist_sms_events
   where phone_hash = public.waitlist_phone_hash('+12125550102') and event = 'granted'),
  1, 'no second grant receipt for a number that was not stored');

-- ── nobody can overwrite an existing number by knowing the email ──────────────
select lives_ok(
  $$ select public.join_waitlist('ok@example.com', true, '(212) 555-0199', true, 'sms-2026-08-07') $$,
  'resubmitting a known email with a different number is silent');
select is((select phone from public.waitlist where email = 'ok@example.com'), '+12125550102',
  'the original number is not replaced');

-- ── a returning visitor may add a number to a row that has none ───────────────
select lives_ok(
  $$ select public.join_waitlist('legacy@example.com', true, '(212) 555-0103', true, 'sms-2026-08-07') $$,
  'a row with no phone can be upgraded');
select is((select phone from public.waitlist where email = 'legacy@example.com'), '+12125550103',
  'the number is added to the existing row');

-- ── forged input ──────────────────────────────────────────────────────────────
select throws_ok(
  $$ select public.join_waitlist('bad@example.com', true, '(212) 555-0104', true, 'sms-1999-01-01') $$,
  '23503', null, 'consent to wording that never existed is rejected by the FK');
select throws_ok(
  $$ select public.join_waitlist('bad2@example.com', true, '555', true, 'sms-2026-08-07') $$,
  'P0001', null, 'an unusable number is reported rather than silently dropped');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — `function public.join_waitlist(unknown, boolean, unknown, boolean, unknown) does not exist`.

- [ ] **Step 3: Write minimal implementation**

Append to `supabase/migrations/0016_waitlist_sms.sql`:

```sql
-- ── join_waitlist, replaced ───────────────────────────────────────────────────
-- Dropped and recreated rather than overloaded: with both a 2-arg and a 5-arg signature
-- present, PostgREST answers PGRST203 for a two-key call instead of choosing. The defaults
-- make deploy order irrelevant — a visitor holding a cached copy of the old app.js sends
-- two keys, hits the defaults, and still joins. .pages.dev caches aggressively.
drop function if exists public.join_waitlist(text, boolean);

create or replace function public.join_waitlist(
  p_email               text,
  p_attested            boolean,
  p_phone               text    default null,
  p_sms_consent         boolean default false,
  p_sms_consent_version text    default null
)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email  text := lower(btrim(p_email));
  v_phone  text;
  v_stored text;
begin
  if p_attested is not true then
    raise exception 'attestation required' using errcode = 'P0001';
  end if;
  if v_email is null
     or length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email' using errcode = 'P0001';
  end if;

  -- Consent is what makes a number storable. No tick, no number — and discarding rather
  -- than rejecting means a stray digit in an optional field never costs someone their
  -- email signup.
  if p_sms_consent is true and p_phone is not null and btrim(p_phone) <> '' then
    v_phone := public.normalize_us_phone(p_phone);
    if v_phone is null then
      -- Raise here: silently dropping would leave them believing a text is coming.
      raise exception 'invalid phone' using errcode = 'P0001';
    end if;
    if p_sms_consent_version is null then
      raise exception 'consent version required' using errcode = 'P0001';
    end if;
  end if;

  begin
    insert into public.waitlist(email, attested_18_us, phone, sms_consent_at, sms_consent_version)
    values (
      v_email, true, v_phone,
      case when v_phone is null then null else now() end,
      case when v_phone is null then null else p_sms_consent_version end
    )
    on conflict (email) do update
      set phone               = excluded.phone,
          sms_consent_at      = excluded.sms_consent_at,
          sms_consent_version = excluded.sms_consent_version
      -- Only upgrade a row that has no number. Without this, anyone who knows your
      -- address could replace your number with theirs.
      where public.waitlist.phone is null and excluded.phone is not null
    returning phone into v_stored;
  exception when unique_violation then
    -- The number is already on the list under a different address. Store the email alone;
    -- anything else would confirm the number is present.
    insert into public.waitlist(email, attested_18_us) values (v_email, true)
    on conflict (email) do nothing;
    v_stored := null;
  end;

  -- Only a confirmed write produces a receipt. Logging on intent instead would record
  -- consent to text a number we never stored and cannot reach.
  if v_stored is not null then
    insert into public.waitlist_sms_events(phone_hash, event, consent_version)
    values (public.waitlist_phone_hash(v_stored), 'granted', p_sms_consent_version);
  end if;
end; $$;

revoke all on function public.join_waitlist(text, boolean, text, boolean, text) from public;
grant execute on function public.join_waitlist(text, boolean, text, boolean, text)
  to anon, authenticated;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS, 37 assertions in `waitlist_sms.test.sql`.

`waitlist.test.sql` may now fail where it calls the two-argument `join_waitlist`. That is expected and correct — the defaults keep those calls working, so any failure there is a real signal. Read it before changing anything.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0016_waitlist_sms.sql supabase/tests/waitlist_sms.test.sql
git commit -m "feat(waitlist): accept an optional consented phone number"
```

---

### Task 4: Unsubscribe receipt and the retention arm

**Files:**
- Modify: `supabase/migrations/0016_waitlist_sms.sql` (append)
- Test: `supabase/tests/waitlist_sms.test.sql` (extend)

**Interfaces:**
- Consumes: `waitlist_phone_hash` from Task 2; `block_waitlist_sms_event_mutation` from Task 1.
- Produces: replaced `public.leave_waitlist(p_token uuid) returns void`, replaced `public.waitlist_retention_sweep() returns void`.

- [ ] **Step 1: Write the failing test**

Change `select plan(37);` to `select plan(42);` and insert before `select * from finish();`:

```sql
-- ── unsubscribe leaves a receipt ──────────────────────────────────────────────
-- The number goes; the proof that they revoked, and when, stays. That is the whole
-- point of keeping the log separate from the row.
select public.join_waitlist('bye@example.com', true, '(212) 555-0105', true, 'sms-2026-08-07');
select public.leave_waitlist(
  (select unsubscribe_token from public.waitlist where email = 'bye@example.com'));

select is((select count(*)::int from public.waitlist where email = 'bye@example.com'), 0,
  'unsubscribing removes the row and the number');
select is(
  (select count(*)::int from public.waitlist_sms_events
   where phone_hash = public.waitlist_phone_hash('+12125550105') and event = 'revoked'),
  1, 'a revoke receipt survives the deleted row');

-- ── the retention sweep may delete from the append-only log, but only past 4y ─
insert into public.waitlist_sms_events(phone_hash, event, created_at)
values ('old-hash', 'granted', now() - interval '5 years'),
       ('new-hash', 'granted', now() - interval '1 year');
select public.waitlist_retention_sweep();

select is((select count(*)::int from public.waitlist_sms_events where phone_hash = 'old-hash'), 0,
  'receipts past the 4-year TCPA limitations period are swept');
select is((select count(*)::int from public.waitlist_sms_events where phone_hash = 'new-hash'), 1,
  'receipts inside the limitations period are kept');

-- The escape hatch must not outlive the sweep's transaction.
select throws_ok(
  $$ delete from public.waitlist_sms_events where phone_hash = 'new-hash' $$,
  'P0001', null, 'the log is append-only again once the sweep has returned');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — the revoke receipt assertion returns `0`, because `leave_waitlist` still only deletes.

- [ ] **Step 3: Write minimal implementation**

Append to `supabase/migrations/0016_waitlist_sms.sql`:

```sql
-- ── leave_waitlist, now leaving a receipt ─────────────────────────────────────
create or replace function public.leave_waitlist(p_token uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_phone text;
begin
  -- Still a no-op on an unknown token, for the same non-enumeration reason as before.
  delete from public.waitlist where unsubscribe_token = p_token
  returning phone into v_phone;

  if v_phone is not null then
    insert into public.waitlist_sms_events(phone_hash, event)
    values (public.waitlist_phone_hash(v_phone), 'revoked');
  end if;
end; $$;

revoke all on function public.leave_waitlist(uuid) from public;
grant execute on function public.leave_waitlist(uuid) to anon, authenticated;

-- ── retention, third arm ──────────────────────────────────────────────────────
-- The trigger that makes the log trustworthy also blocks the job that keeps it from
-- growing forever, so the sweep opens a transaction-local escape hatch. This does mean
-- "append-only" is really "append-only except through this function" — but anything able
-- to set_config and delete is service_role or higher, which could drop the trigger
-- outright. The alternative is an unbounded log.
create or replace function public.waitlist_retention_sweep()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.waitlist
  where (invited_at is not null and invited_at < now() - interval '90 days')
     or created_at < now() - interval '3 years';

  -- true => local to this transaction, so the hatch cannot outlive the sweep
  perform set_config('app.waitlist_sweep', 'on', true);
  -- 4 years: the federal TCPA limitations period (28 U.S.C. 1658). The receipt is the
  -- defense, so it should outlive the phone number but not the claim window.
  delete from public.waitlist_sms_events
  where created_at < now() - interval '4 years';
  perform set_config('app.waitlist_sweep', 'off', true);
end; $$;

revoke all on function public.waitlist_retention_sweep() from public;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS, 42 assertions, all other suites green.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0016_waitlist_sms.sql supabase/tests/waitlist_sms.test.sql
git commit -m "feat(waitlist): log SMS revocation and sweep receipts at four years"
```

---

### Task 5: Canonical disclosure module and drift test

**Files:**
- Create: `src/content/sms-consent.js`
- Create: `test/content/sms-consent.test.mjs`
- Modify: `package.json:62` (widen the `test:scripts` glob)

**Interfaces:**
- Consumes: nothing.
- Produces: `SMS_CONSENT_VERSION` (string `'sms-2026-08-07'`) and `SMS_CONSENT_BODY` (the canonical ASCII disclosure), both named exports.

- [ ] **Step 1: Write the failing test**

Create `test/content/sms-consent.test.mjs`:

```js
// The disclosure lives in three places: this module, the 0016 migration seed, and the
// rendered page. They must agree byte-for-byte, or the consent receipt records agreement
// to wording nobody actually saw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SMS_CONSENT_BODY, SMS_CONSENT_VERSION } from '../../src/content/sms-consent.js';

test('the disclosure carries every element TCPA requires', () => {
  assert.match(SMS_CONSENT_BODY, /~1-2 messages/);
  assert.match(SMS_CONSENT_BODY, /Msg & data rates may apply/);
  assert.match(SMS_CONSENT_BODY, /Reply STOP to opt out/);
  assert.match(SMS_CONSENT_BODY, /Consent isn't required/);
});

test('the disclosure is ASCII, so it cannot silently become a UCS-2 SMS', () => {
  // A curly apostrophe or en-dash pasted in by an editor cuts an SMS segment from 160
  // characters to 70 and breaks the byte-for-byte checks below.
  // eslint-disable-next-line no-control-regex
  assert.ok(/^[\x20-\x7E]+$/.test(SMS_CONSENT_BODY), 'disclosure must be printable ASCII');
});

test('the migration seeds exactly this wording', () => {
  const sql = readFileSync('supabase/migrations/0016_waitlist_sms.sql', 'utf8');
  // SQL escapes a single quote by doubling it.
  assert.ok(
    sql.includes(SMS_CONSENT_BODY.replace(/'/g, "''")),
    'the 0016 seed does not match src/content/sms-consent.js',
  );
  assert.ok(sql.includes(`'${SMS_CONSENT_VERSION}'`), 'the 0016 seed uses a different version');
});
```

The matching assertion for `web/index.html` is deliberately **not** here — it belongs to Task 7,
which is what adds the field. Writing it now would mean committing a knowingly-red test and
leaving CI failing across two tasks.

- [ ] **Step 2: Run test to verify it fails**

First widen the glob in `package.json:62` so the new directory is collected:

```json
"test:scripts": "node --test \"scripts/__tests__/**/*.test.mjs\" \"test/web/**/*.test.mjs\" \"test/content/**/*.test.mjs\"",
```

Run: `npm run test:scripts`
Expected: FAIL — `Cannot find module '.../src/content/sms-consent.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/content/sms-consent.js`:

```js
// The single source of truth for the SMS consent disclosure.
//
// This exact string is seeded into waitlist_sms_consent_versions by migration 0016 and
// rendered into web/index.html. test/content/sms-consent.test.mjs asserts all three agree
// byte-for-byte — because the consent receipt we store points at a version, and a version
// that does not match what the visitor actually read is not proof of anything.
//
// ASCII only, deliberately. Beyond the matching problem, any character outside GSM-7
// forces an SMS into UCS-2, cutting the segment from 160 characters to 70.
//
// Changing the wording means minting a NEW version and inserting it in a new migration.
// Never edit an existing version in place: receipts already point at it.

export const SMS_CONSENT_VERSION = 'sms-2026-08-07';

export const SMS_CONSENT_BODY =
  "Text me when TrueTone launches. ~1-2 messages. Msg & data rates may apply. " +
  "Reply STOP to opt out. Consent isn't required to join.";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:scripts`
Expected: PASS, all three tests, with every pre-existing suite still green.

- [ ] **Step 5: Commit**

```bash
git add src/content/sms-consent.js test/content/sms-consent.test.mjs package.json
git commit -m "feat(waitlist): pin the SMS disclosure to one canonical string"
```

---

### Task 6: `parsePhone` and the client request

**Files:**
- Modify: `web/waitlist-client.js`
- Modify: `test/web/waitlist-client.test.mjs`

**Interfaces:**
- Consumes: `SMS_CONSENT_VERSION` from Task 5 — re-declared as a literal, not imported. `web/` is served verbatim as static files; importing from `src/` would 404 in the browser. The drift test in Task 5 is what keeps the two honest.
- Produces: `parsePhone(raw)` → `{ status: 'blank' | 'ok' | 'invalid', e164? }`; `buildRequest(config, { email, phone, smsConsent })` → `{ url, options }`.

**Breaking change:** `buildRequest`'s second parameter becomes an object. Rewrite its existing specs first.

- [ ] **Step 1: Write the failing test**

In `test/web/waitlist-client.test.mjs`, extend the existing import from
`../../web/waitlist-client.js` to include `parsePhone` and `SMS_CONSENT_VERSION`, replace every
existing `buildRequest(config, 'x@y.com')` call with `buildRequest(config, { email: 'x@y.com' })`,
and append:

```js
test('parsePhone accepts the ways people actually type a number', () => {
  for (const raw of ['2125550100', '(212) 555-0100', '212-555-0100', '+1 212 555 0100', '12125550100']) {
    assert.deepEqual(parsePhone(raw), { status: 'ok', e164: '+12125550100' }, raw);
  }
});

test('parsePhone distinguishes blank from malformed', () => {
  // Blank is fine — the field is optional. Malformed needs to be reported, so a
  // single return value that conflates them would be wrong.
  assert.deepEqual(parsePhone(''), { status: 'blank' });
  assert.deepEqual(parsePhone('   '), { status: 'blank' });
  assert.deepEqual(parsePhone(undefined), { status: 'blank' });
  for (const raw of ['212555010', '21255501000', '+442071838750', 'call me', '+19115550100']) {
    assert.equal(parsePhone(raw).status, 'invalid', raw);
  }
});

test('buildRequest omits the phone entirely when the box is unticked', () => {
  // We should not receive a number the visitor did not consent to give us.
  const { options } = buildRequest(config, {
    email: 'a@b.com', phone: '2125550100', smsConsent: false,
  });
  const body = JSON.parse(options.body);
  assert.equal(body.p_phone, null);
  assert.equal(body.p_sms_consent, false);
  assert.equal(body.p_sms_consent_version, null);
});

test('buildRequest sends the normalized number and the version consented to', () => {
  const { options } = buildRequest(config, {
    email: 'a@b.com', phone: '(212) 555-0100', smsConsent: true,
  });
  const body = JSON.parse(options.body);
  assert.equal(body.p_phone, '+12125550100');
  assert.equal(body.p_sms_consent, true);
  assert.equal(body.p_sms_consent_version, SMS_CONSENT_VERSION);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:scripts`
Expected: FAIL — `parsePhone is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `web/waitlist-client.js`, add after the `OUTCOMES` block:

```js
// Mirrors src/content/sms-consent.js. Re-declared rather than imported: web/ is served
// verbatim as static files, so an import from src/ would 404 in the browser.
// test/content/sms-consent.test.mjs holds the two to the same value.
export const SMS_CONSENT_VERSION = 'sms-2026-08-07';

const N11 = /^[2-9]11$/;

/** Three states rather than `string | null`: blank means the optional field was left
 *  alone, invalid means it was filled in wrongly and the visitor needs telling. A
 *  nullable return would conflate the two and silently drop a typo'd number. */
export function parsePhone(raw) {
  const text = (raw ?? '').trim();
  if (text === '') return { status: 'blank' };

  let digits = text.replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return { status: 'invalid' };

  // Mirrors the CHECK constraint in migration 0016: N11 codes are assignable as neither
  // area code nor exchange, so +19115550100 is not a real number.
  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  if (area[0] < '2' || exchange[0] < '2') return { status: 'invalid' };
  if (N11.test(area) || N11.test(exchange)) return { status: 'invalid' };

  return { status: 'ok', e164: `+1${digits}` };
}
```

Then replace `buildRequest` entirely:

```js
export function buildRequest(config, { email, phone, smsConsent } = {}) {
  const base = config.supabaseUrl.replace(/\/+$/, '');
  // Only a consented, well-formed number is transmitted. Anything else is left in the
  // browser: there is no reason for us to receive a number we may not text.
  const parsed = smsConsent ? parsePhone(phone) : { status: 'blank' };
  const e164 = parsed.status === 'ok' ? parsed.e164 : null;

  return {
    url: `${base}/rest/v1/rpc/join_waitlist`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        p_email: (email ?? '').trim().toLowerCase(),
        // The checkbox is required by the form; the RPC rejects anything else.
        p_attested: true,
        p_phone: e164,
        p_sms_consent: Boolean(e164),
        p_sms_consent_version: e164 ? SMS_CONSENT_VERSION : null,
      }),
    },
  };
}
```

Finally, give the success line an SMS-aware variant. Replace `messageFor`:

```js
const SMS_OK = {
  tone: 'ok',
  text: "You're on the list. We'll email and text you once, when there's a build to try.",
};

/** Fails closed: an unmapped outcome reports failure rather than claiming success, so a
 *  future branch that forgets its case can't tell someone they joined when they didn't. */
export function messageFor(outcome, { sms = false } = {}) {
  if (outcome === OUTCOMES.OK && sms) return SMS_OK;
  return MESSAGES[outcome] ?? MESSAGES[OUTCOMES.SERVER];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:scripts`
Expected: PASS for every `waitlist-client` test. `the page renders exactly this wording` still fails until Task 7.

- [ ] **Step 5: Commit**

```bash
git add web/waitlist-client.js test/web/waitlist-client.test.mjs
git commit -m "feat(waitlist): parse and submit an optional consented phone number"
```

---

### Task 7: Form, wiring, copy gate, and policies

**Files:**
- Modify: `web/index.html`, `web/app.js`, `web/styles.css`
- Modify: `scripts/check-waitlist-copy.mjs`
- Modify: `scripts/__tests__/check-waitlist-copy.test.mjs`
- Modify: `src/content/privacy.md`, `src/content/retention.md`

**Interfaces:**
- Consumes: `parsePhone`, `buildRequest`, `messageFor` from Task 6; `SMS_CONSENT_BODY` from Task 5.
- Produces: nothing further consumes this.

- [ ] **Step 1: Write the failing test**

In `scripts/__tests__/check-waitlist-copy.test.mjs`, append:

```js
// A page that collects phone numbers owes the TCPA disclosure. This is the rule that
// actually bites: a future redesign that drops the fine print while keeping the input
// is exactly the failure worth catching in CI.
const TEL_PAGE = (disclosure) => `
  <main><form>
    <input id="email" type="email" />
    <input id="phone" type="tel" />
    <label>${disclosure}</label>
  </form></main>`;

const FULL = "Text me when TrueTone launches. ~1-2 messages. Msg &amp; data rates may " +
             "apply. Reply STOP to opt out. Consent isn't required to join.";

// auditHtml returns a flat array of { kind, term } violations, so pull out just ours.
const smsGaps = (html) =>
  auditHtml(html, { requireDisclosures: false })
    .filter((v) => v.kind === 'missing-sms-disclosure')
    .map((v) => v.term);

test('a tel input with the full disclosure passes', () => {
  assert.deepEqual(smsGaps(TEL_PAGE(FULL)), []);
});

test('each missing disclosure element is reported', () => {
  const cases = {
    frequency: FULL.replace('~1-2 messages. ', ''),
    rates: FULL.replace('Msg &amp; data rates may apply. ', ''),
    stop: FULL.replace('Reply STOP to opt out. ', ''),
    optional: FULL.replace("Consent isn't required to join.", ''),
  };
  for (const [id, disclosure] of Object.entries(cases)) {
    assert.deepEqual(smsGaps(TEL_PAGE(disclosure)), [id], `expected ${id} to be reported missing`);
  }
});

test('a page with no tel input owes no SMS disclosure', () => {
  // requireDisclosures is false here and the rule still applies: what triggers it is the
  // presence of a phone field, not which page it is.
  assert.deepEqual(smsGaps('<main><form><input id="email" type="email" /></form></main>'), []);
});
```

And in `test/content/sms-consent.test.mjs`, append the third home of the string — the page
itself, which now exists:

```js
test('the page renders exactly this wording', () => {
  const html = readFileSync('web/index.html', 'utf8');
  assert.ok(
    html.replace(/\s+/g, ' ').includes(SMS_CONSENT_BODY.replace(/&/g, '&amp;')),
    'web/index.html does not render the canonical disclosure',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:scripts`
Expected: FAIL — `smsGaps` returns `[]` for every case, because no rule emits
`missing-sms-disclosure` yet, so the four "each missing element is reported" cases fail.

- [ ] **Step 3: Write minimal implementation**

In `scripts/check-waitlist-copy.mjs`, add beside `REQUIRED_DISCLOSURES`:

```js
// Required on any page that collects a phone number. TCPA needs a clear and conspicuous
// disclosure at the point of consent; CTIA guidelines add the opt-out keyword.
// The frequency pattern matches the phrase directly rather than requiring "message" and a
// count in a fixed order — the copy reads "~1-2 messages", so an order-dependent pattern
// would reject the very page it exists to protect.
const SMS_DISCLOSURES = [
  { id: 'frequency', pattern: /~?\s*1\s*-\s*2\s+(msg|message)s?\b/i },
  { id: 'rates',     pattern: /msg\s*&(amp;)?\s*data rates may apply/i },
  { id: 'stop',      pattern: /\breply STOP\b/i },
  { id: 'optional',  pattern: /consent isn't required/i },
];

export function findMissingSmsDisclosures(html) {
  // No phone field, nothing owed.
  if (!/<input[^>]+type=["']tel["']/i.test(html)) return [];
  const copy = htmlToCopy(html);
  return SMS_DISCLOSURES.filter((d) => !d.pattern.test(copy)).map((d) => d.id);
}
```

Then extend `auditHtml` (`scripts/check-waitlist-copy.mjs:123`). Note this entry sits **outside**
the `requireDisclosures` ternary: what triggers it is a phone field on the page, not whether the
page is the landing page. Nothing in `scan()` needs to change — it already counts every returned
violation and exits non-zero.

```js
export function auditHtml(html, { allowedHosts = [], requireDisclosures = true } = {}) {
  return [
    ...findBannedTerms(html),
    ...findUnnegatedMedicalTerms(html),
    ...findForeignOrigins(html, allowedHosts).map((host) => ({ kind: 'foreign-origin', term: host })),
    // Only the landing page makes the product's pitch, so only it owes the disclosures.
    // A policy page states the terms in its own words.
    ...(requireDisclosures
      ? findMissingDisclosures(html).map((id) => ({ kind: 'missing-disclosure', term: id }))
      : []),
    // Gated on the phone field, not on the page: any page collecting a number owes this.
    ...findMissingSmsDisclosures(html).map((id) => ({ kind: 'missing-sms-disclosure', term: id })),
  ];
}
```

In `web/index.html`, insert after the email `<div>`:

```html
        <div>
          <label for="phone">Phone <span class="opt">(optional)</span></label>
          <input id="phone" name="phone" type="tel" inputmode="tel"
                 placeholder="(555) 123-4567" autocomplete="tel" />
        </div>
```

and after the existing attestation `<label class="check">`:

```html
        <label class="check">
          <input id="sms-consent" name="sms-consent" type="checkbox" />
          <span>Text me when TrueTone launches. ~1-2 messages. Msg &amp; data rates may
                apply. Reply STOP to opt out. Consent isn't required to join.
                See our <a href="/policies/privacy.html">Privacy Policy</a>.</span>
        </label>
```

Note this checkbox has **no** `required` attribute — that is the point.

In `web/styles.css`, add:

```css
.opt{color:var(--mauve);font-weight:400}
```

In `web/app.js`, add `parsePhone` to the import, add the two element handles, and insert this validation after the existing attestation check:

```js
  const phone = parsePhone(phoneField.value);
  if (smsConsentField.checked && phone.status !== 'ok') {
    // Only complain when they asked for texts. An unticked box means the field is
    // decoration and a stray character in it must not block the signup.
    show('err', "That doesn't look like a US mobile number. Check it, or untick the text option.");
    phoneField.focus();
    return;
  }
```

Then change the submit call and the success message:

```js
  const { url, options } = buildRequest(config, {
    email: emailField.value,
    phone: phoneField.value,
    smsConsent: smsConsentField.checked,
  });
  try {
    const response = await fetch(url, options);
    const outcome = classifyResponse(response.status);
    const { tone, text } = messageFor(outcome, { sms: smsConsentField.checked && phone.status === 'ok' });
    show(tone, text);
    if (outcome === OUTCOMES.OK) form.reset();
  } catch {
```

In `src/content/privacy.md`, under `## The waitlist`, add:

```markdown
If you choose to give us a phone number, we use it for one thing: to text you when
TrueTone launches. It is optional — the waitlist works without it — and you can opt out
any time by replying STOP. We do not sell, rent, or share it, and we do not use it for
anything other than that launch message.
```

In `src/content/retention.md`, add:

```markdown
- **Waitlist phone numbers:** deleted on the same schedule as the email address they were
  given with, and immediately when you unsubscribe or reply STOP.
- **SMS consent receipts:** kept 4 years. These record that consent was given or withdrawn
  and when, but contain no phone number — only a one-way fingerprint of one.
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:scripts        # every suite, including the page-drift test from Task 5
npm run check:compliance    # copy gate over all 8 pages
npm run waitlist:build      # the generated page must still build
```

Expected: all PASS, including `the page renders exactly this wording`.

- [ ] **Step 5: Commit**

```bash
git add web/ scripts/check-waitlist-copy.mjs scripts/__tests__/check-waitlist-copy.test.mjs src/content/
git commit -m "feat(waitlist): collect an optional phone number with TCPA consent"
```

---

## Final verification

Run before opening a merge request:

```bash
npx supabase db reset && npx supabase test db   # every pgTAP suite, from a clean database
npm run test:scripts                            # node suites
npm test                                        # the app's jest suite, unaffected but confirm
npm run check:compliance                        # copy gate, now including SMS disclosures
npm run check:no-egress                         # image-egress guard
```

Then confirm by hand, because no test covers it: submit the form **with a number and the box
unticked**, and verify in the network panel that `p_phone` is `null`. A number reaching the
server without consent is the one failure this whole design exists to prevent.

## Deploy note

The migration and the page can ship in either order. `join_waitlist`'s defaults mean a visitor
holding a cached copy of the old `app.js` still joins, and the new page against the old function
would fail loudly rather than silently dropping consent. Deploy the migration first anyway — it
is the reversible half.
