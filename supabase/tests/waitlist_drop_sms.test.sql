-- supabase/tests/waitlist_drop_sms.test.sql
-- pgTAP coverage for 0018_waitlist_drop_sms: the dormant SMS schema 0016 added is gone,
-- and the two live functions 0016 had rewritten (leave_waitlist, waitlist_retention_sweep)
-- are back to their SMS-free form. Replaces the 0016-era waitlist_sms test, whose objects
-- 0018 intentionally dropped.
begin;
select plan(13);

-- ── 0016 columns / tables / functions are gone ─────────────────────────────────
select hasnt_column('public', 'waitlist', 'phone', 'waitlist has no phone column');
select hasnt_column('public', 'waitlist', 'sms_consent_at', 'waitlist has no sms_consent_at column');
select hasnt_column('public', 'waitlist', 'sms_consent_version', 'waitlist has no sms_consent_version column');
select hasnt_column('public', 'waitlist', 'sms_invited_at', 'waitlist has no sms_invited_at column');
select hasnt_table('public', 'waitlist_sms_events', 'the SMS consent event log is dropped');
select hasnt_table('public', 'waitlist_sms_consent_versions', 'the SMS consent wording table is dropped');
select hasnt_table('public', 'waitlist_secrets', 'the phone-hash pepper table is dropped');
select hasnt_function('public', 'normalize_us_phone', 'normalize_us_phone is dropped');
select hasnt_function('public', 'waitlist_phone_hash', 'waitlist_phone_hash is dropped');
select hasnt_function('public', 'block_waitlist_sms_event_mutation', 'SMS event-log guard is dropped');
select hasnt_function('public', 'block_consent_version_mutation', 'SMS wording guard is dropped');

-- ── the live functions no longer reference the dropped SMS objects ─────────────
select ok((select prosrc not ilike '%sms%' from pg_proc
            where oid = 'public.leave_waitlist(uuid)'::regprocedure),
  'leave_waitlist is SMS-free');
select ok((select prosrc not ilike '%sms%' from pg_proc
            where oid = 'public.waitlist_retention_sweep()'::regprocedure),
  'waitlist_retention_sweep is SMS-free');

select * from finish();
rollback;
