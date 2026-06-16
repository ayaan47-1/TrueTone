-- record_consent: idempotent; pins the server-side current biometric policy (version + doc_key)
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
      where user_id=v_uid and action='consented' order by created_at desc limit 1;
    return v_row;
  end if;

  insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
    values (v_uid, 'consented', v_version, 'biometric') returning * into v_row;
  update public.profiles set consent_active=true, last_interaction_at=now() where id=v_uid;
  return v_row;
end; $$;

create or replace function public.withdraw_consent()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_version text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select version into v_version from public.policy_versions where doc_key='biometric' and is_current;
  insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
    values (v_uid,'withdrawn',v_version,'biometric');
  update public.profiles set consent_active=false, last_interaction_at=now() where id=v_uid;
end; $$;

create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_version text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select version into v_version from public.policy_versions where doc_key='biometric' and is_current;
  insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
    values (v_uid,'deleted',v_version,'biometric');
  -- de-identify prior consent rows (the trigger permits user_id -> null only)
  update public.consent_log set user_id = null where user_id = v_uid;
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
  delete from public.profiles where id=v_uid;
  delete from auth.users where id=v_uid;
end; $$;

revoke all on function public.record_consent() from public;
revoke all on function public.withdraw_consent() from public;
revoke all on function public.delete_my_data() from public;
revoke all on function public.delete_account() from public;
grant execute on function public.record_consent() to authenticated;
grant execute on function public.withdraw_consent() to authenticated;
grant execute on function public.delete_my_data() to authenticated;
grant execute on function public.delete_account() to authenticated;
