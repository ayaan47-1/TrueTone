-- 0026_profile_flags_lock.sql
-- Security/compliance fix: profile gate flags and consent receipts are server-owned.
-- Clients may update presentation-only identity fields, but cannot directly create a profile,
-- assert adulthood, activate consent, or forge a consent receipt.
--
-- Deployment: this migration is intentionally forward-only and is NOT applied by this change.
-- Ship the matching app build first, then apply this migration before enabling its rollout. Older
-- clients fail closed at profile bootstrap / age verification after the revoke; the new client
-- requires the RPCs created here.

-- Remove broad client writes inherited from 0002_rls.sql. RLS remains defense in depth for the
-- two presentation columns that are still writable.
revoke insert, update on table public.profiles from authenticated, anon;
grant update (username, avatar_uri) on table public.profiles to authenticated;

-- Consent receipts are written only by the consent lifecycle RPCs. Direct inserts could otherwise
-- forge the append-only audit history even though they no longer change profiles.consent_active.
revoke insert on table public.consent_log from authenticated, anon;

-- Profile bootstrap is self-scoped. It replaces the client's former id/last_interaction_at upsert,
-- keeping those server-owned columns out of client grants.
create or replace function public.ensure_profile()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;

  insert into public.profiles(id, last_interaction_at)
    values (v_uid, now())
  on conflict (id) do update
    set last_interaction_at = now();
end; $$;

-- The date of birth stays on-device and is discarded. This RPC persists only the derived adult
-- result and timestamp for the authenticated caller; there is no user-id parameter to tamper with.
create or replace function public.verify_age_18_plus()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;

  update public.profiles
     set is_18_plus = true, age_verified_at = now(), last_interaction_at = now()
   where id = v_uid;
  if not found then raise exception 'profile not found' using errcode='P0001'; end if;
end; $$;

revoke all on function public.ensure_profile() from public;
revoke all on function public.verify_age_18_plus() from public;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.verify_age_18_plus() to authenticated;

-- Replace the current 9-argument record_scan body so the server, not client routing, enforces both
-- gates. Lock the profile row while recording to serialize a concurrent consent withdrawal.
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
  if not found or not coalesce(v_consent_active, false) or not coalesce(v_is_18_plus, false) then
    raise exception 'scan requires active consent and age verification' using errcode='P0001';
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
grant execute on function public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric, text) to authenticated;
