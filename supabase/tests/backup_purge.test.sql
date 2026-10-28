-- supabase/tests/backup_purge.test.sql
begin;
select plan(12);

select has_table('public', 'deletion_audit', 'deletion_audit table exists');
select has_function('public', 'audit_deletion', ARRAY['text','uuid'], 'audit_deletion(text,uuid) exists');

select ok(
  not has_function_privilege('anon', 'public.audit_deletion(text,uuid)', 'EXECUTE'),
  'anon cannot execute audit_deletion'
);
select ok(
  not has_function_privilege('authenticated', 'public.audit_deletion(text,uuid)', 'EXECUTE'),
  'authenticated cannot execute audit_deletion'
);
select ok(
  not has_function_privilege('anon', 'public.truetone_reconcile_deletions()', 'EXECUTE'),
  'anon cannot execute truetone_reconcile_deletions'
);
select ok(
  not has_function_privilege('authenticated', 'public.truetone_reconcile_deletions()', 'EXECUTE'),
  'authenticated cannot execute truetone_reconcile_deletions'
);
select ok(
  has_function_privilege('service_role', 'public.audit_deletion(text,uuid)', 'EXECUTE'),
  'service_role can execute audit_deletion'
);
select ok(
  has_function_privilege('service_role', 'public.truetone_reconcile_deletions()', 'EXECUTE'),
  'service_role can execute truetone_reconcile_deletions'
);
select ok(
  has_function_privilege(
    (select pg_get_userbyid(p.proowner)
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.oid = 'public.audit_deletion(text,uuid)'::regprocedure),
    'public.audit_deletion(text,uuid)',
    'EXECUTE'
  ),
  'audit_deletion owner can execute it'
);
select ok(
  has_function_privilege(
    (select pg_get_userbyid(p.proowner)
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.oid = 'public.truetone_reconcile_deletions()'::regprocedure),
    'public.truetone_reconcile_deletions()',
    'EXECUTE'
  ),
  'truetone_reconcile_deletions owner can execute it'
);

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
