-- Table-level privileges (RLS then restricts which rows are visible)
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.consent_log to authenticated;
grant select on public.policy_versions to anon, authenticated;
-- retention_runs: no grants to client roles

alter table public.profiles enable row level security;
alter table public.consent_log enable row level security;
alter table public.policy_versions enable row level security;
alter table public.retention_runs enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

create policy consent_select_own on public.consent_log
  for select using (user_id = auth.uid());
create policy consent_insert_own on public.consent_log
  for insert with check (user_id = auth.uid());
-- no update/delete policies => denied for all non-privileged roles

create policy policy_versions_read_all on public.policy_versions
  for select using (true);
-- retention_runs: RLS on, no policies => not client-readable
