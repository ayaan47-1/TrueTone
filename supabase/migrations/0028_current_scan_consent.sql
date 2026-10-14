-- Keep the app and scan write gate pinned to the server-current biometric policy. The client may
-- have an older policy bundle during a rolling release, so it must not compare receipt versions.
create or replace function public.has_current_scan_consent()
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_version text;
begin
  if v_uid is null then return false; end if;

  select version into v_version
    from public.policy_versions
   where doc_key = 'biometric' and is_current;
  if v_version is null then return false; end if;

  return exists (
    select 1
      from public.profiles p
      join public.consent_log c on c.user_id = p.id
     where p.id = v_uid
       and p.consent_active
       and c.action = 'consented'
       and c.policy_doc_key = 'biometric'
       and c.policy_version = v_version
  );
end; $$;

revoke all on function public.has_current_scan_consent() from public;
revoke execute on function public.has_current_scan_consent() from anon;
grant execute on function public.has_current_scan_consent() to authenticated;

-- AI processing is downstream of scan consent, so the biometric prerequisite must be current at
-- the database boundary too. An old or direct client cannot rely on consent_active alone.
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
  if not found
     or not coalesce(v_is_18_plus, false)
     or not coalesce(v_scan_consent_active, false)
     or not public.has_current_scan_consent() then
    raise exception 'AI consent requires age verification and current scan consent' using errcode='P0001';
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

revoke all on function public.record_ai_consent() from public;
revoke execute on function public.record_ai_consent() from anon;
grant execute on function public.record_ai_consent() to authenticated;

-- Replace the current 9-argument body so a modified or stale client cannot record a scan under an
-- obsolete biometric receipt. The profile lock still serializes concurrent consent withdrawal.
create or replace function public.record_scan(
  p_scores jsonb, p_skin_type text, p_model_version text, p_is_stub boolean,
  p_routine jsonb, p_routine_version text,
  p_skin_age int default null, p_skin_age_confidence numeric default null,
  p_capture_quality text default null)
returns public.scans
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_row public.scans;
        v_consent_active boolean;
        v_is_18_plus boolean;
        v_keys text[] := array['hydration','oiliness','texture','pores',
                               'darkSpots','redness','fineLines','darkCircles'];
        v_k text; v_v numeric;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;

  select consent_active, is_18_plus
    into v_consent_active, v_is_18_plus
    from public.profiles
   where id = v_uid
   for update;
  if not found
     or not coalesce(v_consent_active, false)
     or not coalesce(v_is_18_plus, false)
     or not public.has_current_scan_consent() then
    raise exception 'scan requires current consent and age verification' using errcode='P0001';
  end if;

  if p_skin_type not in ('dry','oily','combination','sensitive') then
    raise exception 'invalid skin type' using errcode='P0001';
  end if;
  foreach v_k in array v_keys loop
    if jsonb_typeof(p_scores -> v_k) is distinct from 'number' then
      raise exception 'missing or non-numeric score: %', v_k using errcode='P0001';
    end if;
    v_v := (p_scores ->> v_k)::numeric;
    if v_v < 0 or v_v > 1 then raise exception 'score out of range: %', v_k using errcode='P0001'; end if;
  end loop;
  if jsonb_typeof(p_routine -> 'version') is distinct from 'string'
     or jsonb_typeof(p_routine -> 'am') is distinct from 'array'
     or jsonb_typeof(p_routine -> 'pm') is distinct from 'array' then
    raise exception 'malformed routine' using errcode='P0001';
  end if;
  if coalesce(p_routine_version, '') = '' then
    raise exception 'missing routine version' using errcode='P0001';
  end if;
  if p_skin_age is not null and (p_skin_age < 0 or p_skin_age > 120) then
    raise exception 'skin age out of range' using errcode='P0001';
  end if;
  if p_skin_age_confidence is not null and (p_skin_age_confidence < 0 or p_skin_age_confidence > 1) then
    raise exception 'skin age confidence out of range' using errcode='P0001';
  end if;
  if p_capture_quality is not null and p_capture_quality not in ('good','fair','poor') then
    raise exception 'invalid capture quality' using errcode='P0001';
  end if;

  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture, score_pores,
    score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, is_stub, routine, routine_engine_version,
    skin_age_estimate, skin_age_confidence, capture_quality)
  values (v_uid,
    (p_scores->>'hydration')::numeric, (p_scores->>'oiliness')::numeric,
    (p_scores->>'texture')::numeric, (p_scores->>'pores')::numeric,
    (p_scores->>'darkSpots')::numeric, (p_scores->>'redness')::numeric,
    (p_scores->>'fineLines')::numeric, (p_scores->>'darkCircles')::numeric,
    p_skin_type, p_model_version, p_is_stub, p_routine, p_routine_version,
    p_skin_age, p_skin_age_confidence, p_capture_quality)
  returning * into v_row;

  update public.profiles set last_interaction_at = now() where id = v_uid;
  return v_row;
end; $$;

revoke all on function public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric, text) from public;
revoke execute on function public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric, text) from anon;
grant execute on function public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric, text) to authenticated;
