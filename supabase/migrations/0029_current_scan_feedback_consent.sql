-- Routine feedback processes a stored, scan-derived routine. Keep it pinned to the same
-- server-current biometric receipt as scan creation and AI routine/chat processing.
create or replace function public.set_routine_feedback(p_scan_id uuid, p_helpful text)
returns public.scans
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.scans;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  if not public.has_current_scan_consent() then
    raise exception 'routine feedback requires current scan consent' using errcode='P0001';
  end if;
  -- `null not in (...)` is null (falsy), so a null arg would slip past a bare `not in`; guard it
  -- explicitly so feedback can never be silently cleared by a null write.
  if p_helpful is null or p_helpful not in ('helped', 'no_change', 'worse') then
    raise exception 'invalid feedback value' using errcode='P0001';
  end if;
  update public.scans set routine_helpful = p_helpful, feedback_at = now()
   where id = p_scan_id and user_id = v_uid
   returning * into v_row;
  if not found then raise exception 'scan not found' using errcode='P0001'; end if;
  update public.profiles set last_interaction_at = now() where id = v_uid;
  return v_row;
end; $$;

revoke all on function public.set_routine_feedback(uuid, text) from public;
revoke execute on function public.set_routine_feedback(uuid, text) from anon;
grant execute on function public.set_routine_feedback(uuid, text) to authenticated;
