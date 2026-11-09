-- Shade history: cosmetic labels only, never raw tone values or images.
-- Rebuild record_scan after the current consent/age gate so there is one unambiguous
-- signature, while retaining the hardened execution grants from migrations 0026 and 0030.

alter table public.scans
  add column if not exists shade_depth_band text null
    check (shade_depth_band is null or shade_depth_band in ('fair','light','medium','tan','deep')),
  add column if not exists shade_undertone text null
    check (shade_undertone is null or shade_undertone in ('warm','cool','neutral','olive')),
  add column if not exists shade_finish text null
    check (shade_finish is null or shade_finish in ('sheer','natural','satin','dewy','matte','glam')),
  add column if not exists shade_name text null
    check (shade_name is null or shade_name ~ '^[A-Za-z][A-Za-z ''-]{0,39}$'),
  add column if not exists capture_mode text null
    check (capture_mode is null or capture_mode in ('pair','single'));

alter table public.scans
  add constraint scans_shade_all_or_none check (
    (shade_depth_band is null and shade_undertone is null and shade_finish is null and shade_name is null)
    or (shade_depth_band is not null and shade_undertone is not null
        and shade_finish is not null and shade_name is not null));

comment on column public.scans.shade_depth_band is
  'Matched makeup shade depth as a cosmetic band word. Never a number.';
comment on column public.scans.shade_name is
  'Matched makeup shade name, words only. A log of past matches, not a measurement.';
comment on column public.scans.capture_mode is
  'How the selfie was captured: pair or single. Non-biometric metadata.';

-- Drop both signatures before creating the sole canonical function. Without this, calls
-- omitting the two defaulted shade arguments can be ambiguous. Draft PR #64 must rebase its
-- consent-posture changes onto this 11-argument body rather than recreating the 9-argument form.
drop function if exists public.record_scan(
  jsonb, text, text, boolean, jsonb, text, int, numeric, text);
drop function if exists public.record_scan(
  jsonb, text, text, boolean, jsonb, text, int, numeric, text, jsonb, text);

create function public.record_scan(
  p_scores jsonb, p_skin_type text, p_model_version text, p_is_stub boolean,
  p_routine jsonb, p_routine_version text,
  p_skin_age int default null, p_skin_age_confidence numeric default null,
  p_capture_quality text default null,
  p_shade jsonb default null, p_capture_mode text default null)
returns public.scans
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_row public.scans;
        v_consent_active boolean;
        v_is_18_plus boolean;
        v_keys text[] := array['hydration','oiliness','texture','pores',
                               'darkSpots','redness','fineLines','darkCircles'];
        v_shade_keys text[] := array['depthBand','undertone','finish','shadeName'];
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
  if p_capture_mode is not null and p_capture_mode not in ('pair','single') then
    raise exception 'invalid capture mode' using errcode='P0001';
  end if;
  if p_shade is not null then
    if jsonb_typeof(p_shade) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(p_shade)) <> 4 then
      raise exception 'malformed shade' using errcode='P0001';
    end if;
    foreach v_k in array v_shade_keys loop
      if jsonb_typeof(p_shade -> v_k) is distinct from 'string' then
        raise exception 'malformed shade: %', v_k using errcode='P0001';
      end if;
    end loop;
    if p_shade->>'depthBand' not in ('fair','light','medium','tan','deep')
       or p_shade->>'undertone' not in ('warm','cool','neutral','olive')
       or p_shade->>'finish' not in ('sheer','natural','satin','dewy','matte','glam')
       or p_shade->>'shadeName' !~ '^[A-Za-z][A-Za-z ''-]{0,39}$' then
      raise exception 'invalid shade label' using errcode='P0001';
    end if;
  end if;

  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture, score_pores,
    score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, is_stub, routine, routine_engine_version,
    skin_age_estimate, skin_age_confidence, capture_quality,
    shade_depth_band, shade_undertone, shade_finish, shade_name, capture_mode)
  values (v_uid,
    (p_scores->>'hydration')::numeric, (p_scores->>'oiliness')::numeric,
    (p_scores->>'texture')::numeric, (p_scores->>'pores')::numeric,
    (p_scores->>'darkSpots')::numeric, (p_scores->>'redness')::numeric,
    (p_scores->>'fineLines')::numeric, (p_scores->>'darkCircles')::numeric,
    p_skin_type, p_model_version, p_is_stub, p_routine, p_routine_version,
    p_skin_age, p_skin_age_confidence, p_capture_quality,
    p_shade->>'depthBand', p_shade->>'undertone', p_shade->>'finish', p_shade->>'shadeName',
    p_capture_mode)
  returning * into v_row;

  update public.profiles set last_interaction_at = now() where id = v_uid;
  return v_row;
end; $$;

revoke all on function public.record_scan(
  jsonb, text, text, boolean, jsonb, text, int, numeric, text, jsonb, text) from public;
revoke execute on function public.record_scan(
  jsonb, text, text, boolean, jsonb, text, int, numeric, text, jsonb, text) from anon;
grant execute on function public.record_scan(
  jsonb, text, text, boolean, jsonb, text, int, numeric, text, jsonb, text) to authenticated;

create or replace function public.clear_shade_history()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  update public.scans
     set shade_depth_band = null, shade_undertone = null, shade_finish = null,
         shade_name = null, capture_mode = null
   where user_id = v_uid
     and (shade_name is not null or capture_mode is not null);
  get diagnostics v_count = row_count;
  if v_count > 0 then perform public.audit_deletion('scans.shade', v_uid); end if;
  return v_count;
end; $$;

revoke all on function public.clear_shade_history() from public;
revoke execute on function public.clear_shade_history() from anon;
grant execute on function public.clear_shade_history() to authenticated;
