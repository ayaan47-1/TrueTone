-- supabase/migrations/0009_scan_rpcs_retention.sql

-- record_scan: validate derived scores server-side, then insert. Scores arrive as a jsonb
-- map keyed by camelCase dimension (matches src/content/cosmetic-vocab.ts).
create or replace function public.record_scan(
  p_scores jsonb, p_skin_type text, p_model_version text, p_is_stub boolean)
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
    if not (p_scores ? v_k) then raise exception 'missing score: %', v_k using errcode='P0001'; end if;
    v_v := (p_scores ->> v_k)::numeric;
    if v_v < 0 or v_v > 1 then raise exception 'score out of range: %', v_k using errcode='P0001'; end if;
  end loop;

  insert into public.scans(user_id, score_hydration, score_oiliness, score_texture, score_pores,
    score_dark_spots, score_redness, score_fine_lines, score_dark_circles,
    skin_type_feel, model_version, is_stub)
  values (v_uid,
    (p_scores->>'hydration')::numeric, (p_scores->>'oiliness')::numeric,
    (p_scores->>'texture')::numeric, (p_scores->>'pores')::numeric,
    (p_scores->>'darkSpots')::numeric, (p_scores->>'redness')::numeric,
    (p_scores->>'fineLines')::numeric, (p_scores->>'darkCircles')::numeric,
    p_skin_type, p_model_version, p_is_stub)
  returning * into v_row;

  update public.profiles set last_interaction_at = now() where id = v_uid;
  return v_row;
end; $$;

revoke all on function public.record_scan(jsonb, text, text, boolean) from public;
grant execute on function public.record_scan(jsonb, text, text, boolean) to authenticated;

-- BIPA §15(a) purpose-met arm (deferred from 0005): when consent is withdrawn, the purpose for
-- holding scans is gone — destroy them and record the deletion for backup reconciliation.
create or replace function public.purge_scans_on_consent_withdrawn()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.consent_active and not new.consent_active then
    perform public.audit_deletion('scans', old.id);
    delete from public.scans where user_id = old.id;
  end if;
  return new;
end; $$;

create trigger trg_purge_scans_on_withdraw
  after update on public.profiles
  for each row execute function public.purge_scans_on_consent_withdrawn();

-- delete_my_data: also purge scans + audit (extends 0004 with the new table).
create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_version text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  select version into v_version from public.policy_versions where doc_key='biometric' and is_current;
  insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
    values (v_uid,'deleted',v_version,'biometric');
  update public.consent_log set user_id = null where user_id = v_uid;
  perform public.audit_deletion('scans', v_uid);
  delete from public.scans where user_id = v_uid;
  update public.profiles
     set is_18_plus=false, age_verified_at=null, consent_active=false, last_interaction_at=now()
   where id=v_uid;
end; $$;

-- retention sweep: scans cascade when the profile is deleted, but record the audit too.
create or replace function public.truetone_retention_sweep()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_count int := 0; v_version text;
begin
  select version into v_version from public.policy_versions where doc_key='biometric' and is_current;
  for v_id in
    select id from public.profiles where last_interaction_at < now() - interval '3 years'
  loop
    insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
      values (v_id, 'deleted', v_version, 'biometric');
    update public.consent_log set user_id = null where user_id = v_id;
    perform public.audit_deletion('scans', v_id);
    delete from public.profiles where id = v_id;   -- scans + auth.users cascade
    delete from auth.users where id = v_id;
    v_count := v_count + 1;
  end loop;
  insert into public.retention_runs(purged_count) values (v_count);
end; $$;
