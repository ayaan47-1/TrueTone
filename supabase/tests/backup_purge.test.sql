-- supabase/tests/backup_purge.test.sql
begin;
select plan(4);

select has_table('public', 'deletion_audit', 'deletion_audit table exists');
select has_function('public', 'audit_deletion', ARRAY['text','uuid'], 'audit_deletion(text,uuid) exists');

-- a fresh audit row is unreconciled; one past its PITR window reconciles
insert into public.deletion_audit(user_id, table_name, deleted_at)
  values ('11111111-1111-1111-1111-111111111111', 'scans', now());
insert into public.deletion_audit(user_id, table_name, deleted_at, pitr_window)
  values ('22222222-2222-2222-2222-222222222222', 'scans', now() - interval '10 days', interval '7 days');

select public.truetone_reconcile_deletions();

select is(
  (select count(*) from public.deletion_audit
     where user_id='22222222-2222-2222-2222-222222222222' and reconciled_at is not null)::int,
  1, 'aged row past PITR window is reconciled');
select is(
  (select count(*) from public.deletion_audit
     where user_id='11111111-1111-1111-1111-111111111111' and reconciled_at is not null)::int,
  0, 'fresh row stays unreconciled');

select * from finish();
rollback;
