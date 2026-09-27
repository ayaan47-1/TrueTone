-- Allergen P1 (design §2.4): consent receipts for the on-device ingredient flags, pinned to the
-- existing 'wa_health' policy doc. Functions only: no table, no column, no CHECK change — the
-- flags themselves never reach the server. Separate from the biometric record_consent().
create or replace function public.record_health_data_consent()
returns public.consent_log
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_version text;
        v_row public.consent_log;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select version into v_version from public.policy_versions where doc_key='wa_health' and is_current;
  if v_version is null then raise exception 'no current wa_health policy' using errcode='P0001'; end if;

  -- idempotent: if the caller's latest wa_health receipt is an active consent, return it
  select * into v_row from public.consent_log
    where user_id=v_uid and policy_doc_key='wa_health' order by created_at desc limit 1;
  if found and v_row.action = 'consented' then return v_row; end if;

  insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
    values (v_uid, 'consented', v_version, 'wa_health') returning * into v_row;
  update public.profiles set last_interaction_at=now() where id=v_uid;
  return v_row;
end; $$;

create or replace function public.withdraw_health_data_consent()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_version text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select version into v_version from public.policy_versions where doc_key='wa_health' and is_current;
  if v_version is null then raise exception 'no current wa_health policy' using errcode='P0001'; end if;
  insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
    values (v_uid, 'withdrawn', v_version, 'wa_health');
  update public.profiles set last_interaction_at=now() where id=v_uid;
end; $$;

revoke all on function public.record_health_data_consent() from public;
revoke all on function public.withdraw_health_data_consent() from public;
grant execute on function public.record_health_data_consent() to authenticated;
grant execute on function public.withdraw_health_data_consent() to authenticated;
