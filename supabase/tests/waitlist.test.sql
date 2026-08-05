-- supabase/tests/waitlist.test.sql
-- pgTAP coverage for migration 0014_waitlist:
--   • waitlist table exists with RLS on and NO anon table privileges (write-only funnel)
--   • join_waitlist() is the only anon path in: it normalises, validates and dedupes
--   • it returns void, so a signup can never be used to probe whether an email is on the list
--   • the 18+/US attestation is required by the RPC and by a CHECK constraint
--   • leave_waitlist() honours the one-tap unsubscribe promise made on the page
--   • waitlist_retention_sweep() purges on purpose-met (invited) and on the 3-year backstop
--
-- The waitlist holds an email address, never biometric or skin data — it sits entirely
-- outside the compliance boundary in CLAUDE.md §3. The retention arm still applies.
begin;
select plan(20);

-- ── 1. shape ──────────────────────────────────────────────────────────────────
select has_table('public', 'waitlist', 'waitlist table exists');
select has_column('public', 'waitlist', 'unsubscribe_token', 'waitlist carries an unsubscribe token');
select is((select relrowsecurity from pg_class where relname = 'waitlist'), true,
  'RLS enabled on waitlist');

-- RLS is on and the migration grants no table privileges and defines no policies, so the
-- list is unreadable by any client role. Only the security-definer RPCs may touch it.
select table_privs_are('public', 'waitlist', 'anon', '{}',
  'anon holds no table privileges on waitlist');
select table_privs_are('public', 'waitlist', 'authenticated', '{}',
  'authenticated holds no table privileges on waitlist');

-- service_role is the server-side key and is never shipped to a client, so it is the one
-- role allowed to read the list — otherwise invites could never be sent. It gets SELECT and
-- UPDATE (to stamp invited_at) but NOT DELETE: removal happens through leave_waitlist or
-- the retention sweep, so a stray backend call can't quietly drop signups.
select table_privs_are('public', 'waitlist', 'service_role', '{SELECT,UPDATE}',
  'service_role can read and mark the list, but not delete from it');

-- ── 2. anon can join, and only via the RPC ────────────────────────────────────
set local role anon;

select lives_ok($$ select public.join_waitlist('Reader@Example.COM  ', true) $$,
  'anon can join the waitlist through the RPC');

select throws_ok($$ select count(*) from public.waitlist $$,
  '42501', null, 'anon cannot read the waitlist table directly');

reset role;

select is((select count(*) from public.waitlist)::int, 1, 'the signup stored exactly one row');
select is((select email from public.waitlist), 'reader@example.com',
  'email is normalised to lowercase and trimmed');
select is((select attested_18_us from public.waitlist), true,
  'the stored row records the 18+/US attestation');

-- ── 3. a repeat signup is silent and idempotent ───────────────────────────────
-- Returning void on conflict is deliberate: a distinguishable response would let anyone
-- test whether a given address is on the list.
set local role anon;
select lives_ok($$ select public.join_waitlist('reader@example.com', true) $$,
  'a duplicate signup succeeds silently rather than erroring');
reset role;

select is((select count(*) from public.waitlist)::int, 1,
  'a duplicate signup does not add a second row');

-- ── 4. validation ─────────────────────────────────────────────────────────────
set local role anon;
select throws_ok($$ select public.join_waitlist('someone@example.com', false) $$,
  'P0001', 'attestation required', 'joining without the 18+/US attestation is rejected');

select throws_ok($$ select public.join_waitlist('not-an-email', true) $$,
  'P0001', 'invalid email', 'a malformed email is rejected');
reset role;

-- The CHECK constraint is the backstop if a future code path bypasses the RPC.
select throws_ok($$
  insert into public.waitlist(email, attested_18_us) values ('x@example.com', false)
$$, '23514', null, 'CHECK constraint rejects a row with no attestation');

-- ── 5. one-tap unsubscribe (the page promises this in writing) ─────────────────
set local role anon;
select lives_ok($$ select public.leave_waitlist('00000000-0000-0000-0000-000000000000'::uuid) $$,
  'an unknown unsubscribe token is a silent no-op, not an error');
reset role;

select lives_ok($$
  select public.leave_waitlist((select unsubscribe_token from public.waitlist limit 1))
$$, 'leave_waitlist accepts a real token');

select is((select count(*) from public.waitlist)::int, 0,
  'unsubscribing removes the row outright');

-- ── 6. retention: purpose-met arm and 3-year backstop ─────────────────────────
insert into public.waitlist(email, attested_18_us, created_at, invited_at) values
  ('invited-long-ago@example.com', true, now() - interval '200 days', now() - interval '120 days'),
  ('never-invited-ancient@example.com', true, now() - interval '4 years', null),
  ('invited-recently@example.com', true, now() - interval '10 days', now() - interval '3 days'),
  ('fresh@example.com', true, now(), null);

select public.waitlist_retention_sweep();

select results_eq(
  $$ select email from public.waitlist order by email $$,
  $$ values ('fresh@example.com'), ('invited-recently@example.com') $$,
  'sweep purges invited-90d+ and 3-year-old rows, keeps fresh and recently invited ones');

select * from finish();
rollback;
