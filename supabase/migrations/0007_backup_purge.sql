-- supabase/migrations/0007_backup_purge.sql
-- BIPA §15(a)/(e): live deletion is immediate, but backup/PITR copies must be proven
-- gone "on a defined cycle". This records every biometric-derived deletion and a job
-- marks it reconciled once the documented PITR window has elapsed. See docs/compliance/pitr-purge.md.
create table public.deletion_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                                   -- subject of the deletion (may be null after de-id)
  table_name text not null,
  deleted_at timestamptz not null default now(),
  pitr_window interval not null default interval '7 days',
  reconciled_at timestamptz
);
create index deletion_audit_open_idx on public.deletion_audit (reconciled_at) where reconciled_at is null;

alter table public.deletion_audit enable row level security; -- no policies => not client-readable

create or replace function public.audit_deletion(p_table text, p_user uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.deletion_audit(user_id, table_name) values (p_user, p_table);
$$;

create or replace function public.truetone_reconcile_deletions()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.deletion_audit
     set reconciled_at = now()
   where reconciled_at is null
     and deleted_at + pitr_window <= now();
end; $$;

revoke all on function public.audit_deletion(text, uuid) from public;
revoke all on function public.truetone_reconcile_deletions() from public;

select cron.schedule('truetone-reconcile-deletions', '30 3 * * *',
  $$ select public.truetone_reconcile_deletions(); $$);
