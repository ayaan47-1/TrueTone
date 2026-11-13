-- 0042_profile_avatar_lock.sql  (placeholder number: renumber at merge if 0041/0042 collide)
-- MASVS M1 (Dwight round-2 ruling): profiles.avatar_uri held device-local file paths
-- (file:///var/mobile/... from older clients). A device-local path must not remain server-side, so:
--   1. scrub every existing value;
--   2. take client write access away (0026 granted UPDATE (username, avatar_uri));
--   3. constrain the column to null so no role, including an older client or a future grant, can
--      store a path again;
--   4. make Delete My Data clear it server-side, authoritatively.
-- The current app keeps the photo path only in encrypted on-device storage and sends username only.
--
-- Deployment: forward-only and NOT applied by this change. Ship the matching app build first.
-- Older clients that still send avatar_uri in their profile save will get a permission error
-- (fail closed); their username change is refused until they update.

-- Owner-only scrub, kept as a function so pgTAP can seed legacy rows and prove it works.
-- Returns how many rows it cleared. No client role may execute it.
create or replace function public.scrub_profile_avatar_uris() returns integer
language plpgsql set search_path = public, pg_temp as $$
declare n integer;
begin
  update public.profiles set avatar_uri = null where avatar_uri is not null;
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.scrub_profile_avatar_uris() from public, anon, authenticated;

select public.scrub_profile_avatar_uris();

revoke insert (avatar_uri), update (avatar_uri) on table public.profiles from authenticated, anon;
-- 0026 already removed table-level INSERT/UPDATE; restate the only client-writable column.
grant update (username) on table public.profiles to authenticated;

alter table public.profiles
  add constraint profiles_avatar_uri_unused check (avatar_uri is null);

comment on column public.profiles.avatar_uri is
  'Unused. Must stay null: avatar paths are device-local (MASVS M1). Locked by 0042_profile_avatar_lock.';

-- Same body as 0039_shade_feedback.sql, plus avatar_uri = null on the surviving profile row.
-- create or replace keeps the existing EXECUTE grants (authenticated only).
create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); v text; feedback_version text;
begin
  if uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  perform 1 from public.profiles where id=uid for update;
  select version into v from public.policy_versions where doc_key='biometric' and is_current;
  select policy_version into feedback_version from public.consent_log where user_id=uid and policy_doc_key='shade_feedback' order by created_at desc,id desc limit 1;
  if feedback_version is not null then
    insert into public.consent_log(user_id,action,policy_version,policy_doc_key,created_at) values(uid,'deleted',feedback_version,'shade_feedback',clock_timestamp());
  end if;
  perform public.purge_shade_feedback_for_user(uid);
  insert into public.consent_log(user_id,action,policy_version,policy_doc_key) values(uid,'deleted',v,'biometric');
  update public.consent_log set user_id=null where user_id=uid;
  delete from public.scans where user_id=uid;
  if found then perform public.audit_deletion('scans',uid); end if;
  update public.profiles set is_18_plus=false,age_verified_at=null,consent_active=false,avatar_uri=null,last_interaction_at=now() where id=uid;
end; $$;
