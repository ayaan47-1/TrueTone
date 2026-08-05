-- supabase/migrations/0014_waitlist.sql
-- Pre-launch waitlist for the marketing page in web/.
--
-- This table holds an email address and a 18+/US attestation. It holds no face image, no
-- scan, no score and no health inference, so it sits entirely outside the compliance
-- boundary in CLAUDE.md §3 — but the retention arm still applies, hence the sweep below.
--
-- Shape of the funnel: anon can WRITE (through one security-definer RPC) and can never
-- READ. RLS is enabled with no policies and every table privilege is revoked, so the list
-- is unreachable except through the two RPCs defined here. Both return void on purpose:
-- a response that varied by outcome would turn the signup form into an oracle for testing
-- whether a given address is already on the list.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  -- Normalised (lowercased, trimmed) by join_waitlist so the unique index actually dedupes.
  email text not null unique,
  -- Only attested signups are storable; the RPC checks it and this CHECK is the backstop.
  attested_18_us boolean not null check (attested_18_us),
  -- Backs the "unsubscribe in one click" promise made on the page.
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Set when the invite email goes out; starts the 90-day purpose-met retention clock.
  invited_at timestamptz
);

comment on table public.waitlist is
  'Pre-launch email waitlist. No biometric or skin data. Write-only for anon via join_waitlist().';

-- Supabase grants table privileges to anon/authenticated by default; revoke them so the
-- security-definer RPCs are the only way in or out.
revoke all on public.waitlist from anon, authenticated;

alter table public.waitlist enable row level security;
-- RLS on with no policies => no client role can read or write rows directly.

-- ── join: the only anon path in ───────────────────────────────────────────────
create or replace function public.join_waitlist(p_email text, p_attested boolean)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_email text := lower(btrim(p_email));
begin
  if p_attested is not true then
    raise exception 'attestation required' using errcode = 'P0001';
  end if;
  if v_email is null
     or length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email' using errcode = 'P0001';
  end if;

  -- Silent on conflict: a repeat signup must be indistinguishable from a first one.
  insert into public.waitlist(email, attested_18_us)
  values (v_email, true)
  on conflict (email) do nothing;
end; $$;

revoke all on function public.join_waitlist(text, boolean) from public;
grant execute on function public.join_waitlist(text, boolean) to anon, authenticated;

-- ── leave: one-tap unsubscribe ────────────────────────────────────────────────
create or replace function public.leave_waitlist(p_token uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- No-op on an unknown token, for the same non-enumeration reason as join_waitlist.
  delete from public.waitlist where unsubscribe_token = p_token;
end; $$;

revoke all on function public.leave_waitlist(uuid) from public;
grant execute on function public.leave_waitlist(uuid) to anon, authenticated;

-- ── retention ─────────────────────────────────────────────────────────────────
-- Two arms, mirroring the schedule published in src/content/retention.md:
--   • purpose met  — 90 days after the invite email goes out, the address has done its job
--   • backstop     — 3 years after signup, whether or not an invite ever went out
-- Kept separate from truetone_retention_sweep() because that one is about biometric
-- inactivity under BIPA §15(a) and deletes auth users; this one only drops email rows.
create or replace function public.waitlist_retention_sweep()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.waitlist
  where (invited_at is not null and invited_at < now() - interval '90 days')
     or created_at < now() - interval '3 years';
end; $$;

revoke all on function public.waitlist_retention_sweep() from public;

select cron.schedule('truetone-waitlist-retention', '15 3 * * *',
  $$ select public.waitlist_retention_sweep(); $$);
