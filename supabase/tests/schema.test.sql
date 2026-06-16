begin;
select plan(7);
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'consent_log', 'consent_log exists');
select has_table('public', 'policy_versions', 'policy_versions exists');
select has_table('public', 'retention_runs', 'retention_runs exists');
select col_is_pk('public', 'profiles', 'id', 'profiles pk is id');
select hasnt_column('public', 'profiles', 'dob', 'profiles never stores dob');
-- a consent receipt cannot reference a non-existent policy (composite FK)
select throws_ok(
  $$ insert into public.consent_log(action, policy_version) values ('consented','nonexistent') $$,
  '23503', null, 'consent_log policy_version FK enforced');
select * from finish();
rollback;
