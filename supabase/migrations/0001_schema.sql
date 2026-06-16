create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_18_plus boolean not null default false,
  age_verified_at timestamptz,
  consent_active boolean not null default false,
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.policy_versions (
  version text not null,
  doc_key text not null check (doc_key in ('privacy','terms','biometric','retention','wa_health')),
  effective_at timestamptz not null default now(),
  is_current boolean not null default false,
  primary key (version, doc_key)
);
create unique index policy_versions_current_per_doc
  on public.policy_versions (doc_key) where is_current;

create type consent_action as enum ('consented','withdrawn','deleted');

create table public.consent_log (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid not null default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action consent_action not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);
create index consent_log_user_idx on public.consent_log(user_id);

create table public.retention_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  purged_count int not null default 0
);
