begin;
select plan(2);
-- policies are seeded by migration 0006; use the seeded biometric version
insert into auth.users(id) values ('33333333-3333-3333-3333-333333333333');
insert into public.profiles(id) values ('33333333-3333-3333-3333-333333333333');
insert into public.consent_log(user_id, action, policy_version)
  values ('33333333-3333-3333-3333-333333333333','consented','2026-06-15.1');

select throws_ok(
  $$ update public.consent_log set action = 'withdrawn' $$,
  'P0001', 'consent_log is append-only', 'update blocked');
select throws_ok(
  $$ delete from public.consent_log $$,
  'P0001', 'consent_log is append-only', 'delete blocked');
select * from finish();
rollback;
