-- supabase/migrations/0012_routine_feedback.sql
-- Step 7 "did this help?": capture whether a routine helped, as derived feedback on the existing
-- scan row. Inherits RLS, delete-everything (delete_my_data purges scans), the 3-year retention
-- sweep, and the backup/PITR purge — NO new retention/deletion code is needed.
alter table public.scans
  add column routine_helpful text,
  add column feedback_at timestamptz;

alter table public.scans
  add constraint scans_routine_helpful_chk
  check (routine_helpful is null or routine_helpful in ('helped', 'no_change', 'worse'));

-- Clients have SELECT-only RLS on scans (see 0008); feedback writes go through this SECURITY
-- DEFINER RPC, which updates ONLY the caller's own row and validates the value at the boundary.
create or replace function public.set_routine_feedback(p_scan_id uuid, p_helpful text)
returns public.scans
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.scans;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
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
grant execute on function public.set_routine_feedback(uuid, text) to authenticated;
