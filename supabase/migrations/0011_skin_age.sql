-- supabase/migrations/0011_skin_age.sql
-- Additive: skin-appearance-age columns on scans + extend record_scan to accept them.
-- Both columns nullable; absolute age stays NULL until SKIN_AGE_ABSOLUTE_ENABLED is flipped
-- (validation gate, CLAUDE.md §1). Inherits scans RLS, retention sweep, and delete_my_data().

alter table public.scans
  add column if not exists skin_age_estimate int null
    check (skin_age_estimate is null or skin_age_estimate between 0 and 120),
  add column if not exists skin_age_confidence numeric(4,3) null
    check (skin_age_confidence is null or skin_age_confidence between 0 and 1);

-- Replace the 6-arg RPC with an 8-arg version (two trailing nullable params).
drop function if exists public.record_scan(jsonb, text, text, boolean, jsonb, text);

create or replace function public.record_scan(
  p_scores jsonb, p_skin_type text, p_model_version text, p_is_stub boolean,
  p_routine jsonb, p_routine_version text,
  p_skin_age int default null, p_skin_age_confidence numeric default null)
returns public.scans
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
        v_row public.scans;
        v_keys text[] := array['hydration','oiliness','texture','pores',
                               'darkSpots','redness','fineLines','darkCircles'];
        v_k text; v_v numeric;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
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

  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture, score_pores,
    score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, is_stub, routine, routine_engine_version,
    skin_age_estimate, skin_age_confidence)
  values (v_uid,
    (p_scores->>'hydration')::numeric, (p_scores->>'oiliness')::numeric,
    (p_scores->>'texture')::numeric, (p_scores->>'pores')::numeric,
    (p_scores->>'darkSpots')::numeric, (p_scores->>'redness')::numeric,
    (p_scores->>'fineLines')::numeric, (p_scores->>'darkCircles')::numeric,
    p_skin_type, p_model_version, p_is_stub, p_routine, p_routine_version,
    p_skin_age, p_skin_age_confidence)
  returning * into v_row;

  update public.profiles set last_interaction_at = now() where id = v_uid;
  return v_row;
end; $$;

revoke all on function public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric) from public;
grant execute on function public.record_scan(jsonb, text, text, boolean, jsonb, text, int, numeric) to authenticated;
