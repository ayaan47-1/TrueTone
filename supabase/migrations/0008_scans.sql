-- supabase/migrations/0008_scans.sql
-- Derived cosmetic scores ONLY (no image ever crosses the boundary, CLAUDE.md §3).
-- Append-only history so the future trend loop needs no schema change.
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  captured_at timestamptz not null default now(),
  score_hydration   numeric(4,3) not null check (score_hydration   between 0 and 1),
  score_oiliness    numeric(4,3) not null check (score_oiliness    between 0 and 1),
  score_texture     numeric(4,3) not null check (score_texture     between 0 and 1),
  score_pores       numeric(4,3) not null check (score_pores       between 0 and 1),
  score_dark_spots  numeric(4,3) not null check (score_dark_spots  between 0 and 1),
  score_redness     numeric(4,3) not null check (score_redness     between 0 and 1),
  score_fine_lines  numeric(4,3) not null check (score_fine_lines  between 0 and 1),
  score_dark_circles numeric(4,3) not null check (score_dark_circles between 0 and 1),
  skin_type_feel text not null check (skin_type_feel in ('dry','oily','combination','sensitive')),
  model_version text not null,
  is_stub boolean not null default true,
  created_at timestamptz not null default now()
);
create index scans_user_time_idx on public.scans (user_id, captured_at desc);

grant select on public.scans to authenticated;            -- insert is via record_scan RPC only
alter table public.scans enable row level security;

create policy scans_select_own on public.scans
  for select using (user_id = auth.uid());
-- no insert/update/delete policies => clients can only read; writes go through SECURITY DEFINER RPC
