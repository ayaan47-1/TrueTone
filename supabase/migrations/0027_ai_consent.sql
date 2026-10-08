-- Draft A: separate, versioned consent for Anthropic-backed routine/chat.
-- The scan consent remains independent; local reads and non-AI routines do not use this flag.

alter table public.policy_versions
  drop constraint policy_versions_doc_key_check;
alter table public.policy_versions
  add constraint policy_versions_doc_key_check
  check (doc_key in ('privacy','terms','biometric','retention','wa_health','ai_routine_chat'));

update public.policy_versions
   set is_current = false
 where doc_key in ('privacy','terms','biometric','retention','wa_health');

insert into public.policy_versions(version, doc_key, is_current) values
  ('2026-10-06.a1','privacy', true),
  ('2026-10-06.a1','terms', true),
  ('2026-10-06.a1','biometric', true),
  ('2026-10-06.a1','retention', true),
  ('2026-10-06.a1','wa_health', true),
  ('2026-10-06.a1','ai_routine_chat', true);

alter table public.profiles
  add column ai_consent_active boolean not null default false;

-- Re-pin biometric consent to the new Draft A version. Filtering by policy_doc_key matters now
-- that the shared append-only receipt table also contains AI consent receipts.
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
    select * into v_row from public.consent_log
      where user_id=v_uid and action='consented' and policy_doc_key='biometric'
      order by created_at desc limit 1;
    return v_row;
  end if;

  insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
    values (v_uid, 'consented', v_version, 'biometric') returning * into v_row;
  update public.profiles set consent_active=true, last_interaction_at=now() where id=v_uid;
  return v_row;
end; $$;

create or replace function public.record_ai_consent()
returns public.consent_log
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_version text;
        v_row public.consent_log;
        v_is_18_plus boolean;
        v_scan_consent_active boolean;
        v_ai_consent_active boolean;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select is_18_plus, consent_active, ai_consent_active
    into v_is_18_plus, v_scan_consent_active, v_ai_consent_active
    from public.profiles where id=v_uid for update;
  if not found or not coalesce(v_is_18_plus, false) or not coalesce(v_scan_consent_active, false) then
    raise exception 'AI consent requires age verification and active scan consent' using errcode='P0001';
  end if;
  select version into v_version from public.policy_versions
    where doc_key='ai_routine_chat' and is_current;
  if v_version is null then raise exception 'no current AI consent policy' using errcode='P0001'; end if;

  if v_ai_consent_active then
    update public.profiles set last_interaction_at=now() where id=v_uid;
    select * into v_row from public.consent_log
      where user_id=v_uid and action='consented' and policy_doc_key='ai_routine_chat'
      order by created_at desc limit 1;
    return v_row;
  end if;

  insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
    values (v_uid, 'consented', v_version, 'ai_routine_chat') returning * into v_row;
  update public.profiles set ai_consent_active=true, last_interaction_at=now() where id=v_uid;
  return v_row;
end; $$;

create or replace function public.withdraw_ai_consent()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_version text;
        v_ai_consent_active boolean;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select ai_consent_active into v_ai_consent_active
    from public.profiles where id=v_uid for update;
  if not found then raise exception 'profile not found' using errcode='P0001'; end if;
  if not v_ai_consent_active then return; end if;

  select version into v_version from public.policy_versions
    where doc_key='ai_routine_chat' and is_current;
  insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
    values (v_uid, 'withdrawn', v_version, 'ai_routine_chat');
  update public.profiles set ai_consent_active=false, last_interaction_at=now() where id=v_uid;
end; $$;

-- Extend delete-everything so the optional AI authorization cannot survive a data deletion.
create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_biometric_version text;
        v_ai_version text;
        v_ai_consent_active boolean;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select ai_consent_active into v_ai_consent_active
    from public.profiles where id=v_uid for update;
  if not found then raise exception 'profile not found' using errcode='P0001'; end if;

  select version into v_biometric_version from public.policy_versions
    where doc_key='biometric' and is_current;
  insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
    values (v_uid,'deleted',v_biometric_version,'biometric');
  if v_ai_consent_active then
    select version into v_ai_version from public.policy_versions
      where doc_key='ai_routine_chat' and is_current;
    insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
      values (v_uid,'deleted',v_ai_version,'ai_routine_chat');
  end if;

  update public.consent_log set user_id = null where user_id = v_uid;
  delete from public.scans where user_id = v_uid;
  if found then perform public.audit_deletion('scans', v_uid); end if;
  update public.profiles
     set is_18_plus=false,
         age_verified_at=null,
         consent_active=false,
         ai_consent_active=false,
         last_interaction_at=now()
   where id=v_uid;
end; $$;

revoke all on function public.record_ai_consent() from public;
revoke all on function public.withdraw_ai_consent() from public;
grant execute on function public.record_ai_consent() to authenticated;
grant execute on function public.withdraw_ai_consent() to authenticated;

-- Re-assert the existing lifecycle RPC grants after replacement.
revoke all on function public.record_consent() from public;
revoke all on function public.delete_my_data() from public;
grant execute on function public.record_consent() to authenticated;
grant execute on function public.delete_my_data() to authenticated;
