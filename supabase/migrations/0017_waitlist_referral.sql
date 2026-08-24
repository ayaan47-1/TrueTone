-- supabase/migrations/0017_waitlist_referral.sql
-- In-house referral loop for the pre-launch waitlist (the shade pivot).
--
-- The pivot dropped SMS from the marketing page: web/ now collects an email plus an
-- optional referral code (?ref=) and a privacy-safe UTM/referrer source, and rewards
-- inviting friends by moving the inviter up the line. This migration adds exactly that
-- and nothing else — the SMS columns/tables from 0016 are left untouched (SMS never went
-- live, so there is nothing to purge; see PAM-COPY-FIXES.md).
--
-- The funnel shape from 0014 is preserved: anon can WRITE through security-definer RPCs
-- and can never READ a row. The one new read is waitlist_count(), which returns a single
-- aggregate integer — a total, never a list — so it can drive a live counter on the page
-- without turning the form into an enumeration oracle.
--
-- Nothing here touches the compliance boundary in CLAUDE.md §3: no face image, no scan,
-- no score, no health inference — only an email, an attestation, a referral graph, and a
-- UTM blob.

-- ── referral columns ──────────────────────────────────────────────────────────
alter table public.waitlist
  -- Each signup's own shareable code (hex, generated server-side). Nullable so the
  -- pre-existing rows from 0014 stay valid; every new row gets one.
  add column code        text,
  -- The code of the person who referred them, if any. First-touch: set once, never
  -- overwritten (see join_waitlist).
  add column referred_by text,
  -- Privacy-safe attribution: the UTM allowlist + referrer captured by the client. No
  -- third party ever sees it; it lives only in this row.
  add column source      jsonb;

-- A full unique constraint (not a partial index): it doubles as the target the
-- self-referential FK below points at. Postgres lets many rows hold a NULL code under a
-- UNIQUE constraint, which is what keeps the 0014 rows legal.
alter table public.waitlist add constraint waitlist_code_key unique (code);

-- The generator emits lowercase hex; the client (web/waitlist-client.js) accepts
-- ^[a-z0-9]{6,32}$. Pin the stored shape to the same envelope so a hand-written row can
-- never mint a code the share link or the ?ref parser would later reject.
alter table public.waitlist add constraint waitlist_code_format
  check (code is null or code ~ '^[a-z0-9]{6,32}$');

-- referred_by must name a real code. ON DELETE SET NULL so that when a referrer
-- unsubscribes (leave_waitlist deletes their row) the people they referred are simply
-- un-attributed rather than orphaning a dangling code.
alter table public.waitlist add constraint waitlist_referred_by_fk
  foreign key (referred_by) references public.waitlist(code) on delete set null;

-- ── code generator ─────────────────────────────────────────────────────────────
-- gen_random_bytes(6) => 12 lowercase hex chars (48 bits): collisions are astronomically
-- unlikely, but the loop makes the unique constraint a backstop rather than a way for a
-- signup to fail. On the vanishingly rare repeated collision it widens the code instead
-- of spinning.
create or replace function public.gen_waitlist_code()
returns text
-- pgcrypto's gen_random_bytes lives in the `extensions` schema on Supabase (local + hosted),
-- so `extensions` must be on the search_path or the code generator — and every join_waitlist
-- call that depends on it — fails with "function gen_random_bytes(integer) does not exist".
language plpgsql volatile security definer set search_path = public, extensions, pg_temp as $$
declare
  v_code text;
  v_try  int := 0;
begin
  loop
    v_code := encode(gen_random_bytes(6), 'hex');
    exit when not exists (select 1 from public.waitlist where code = v_code);
    v_try := v_try + 1;
    if v_try >= 5 then
      v_code := encode(gen_random_bytes(12), 'hex');
      exit;
    end if;
  end loop;
  return v_code;
end; $$;

revoke all on function public.gen_waitlist_code() from public;

-- ── join_waitlist, replaced for the pivot ──────────────────────────────────────
-- Dropped and recreated rather than overloaded: leaving the 5-arg SMS signature from 0016
-- in place alongside this 4-arg one makes PostgREST answer PGRST203 (cannot choose an
-- overload) for a referral-shaped call. The pivot's page only ever sends this shape.
--
-- Returns the caller's own row as jsonb — their code, spot in line, total on the list, and
-- how many people they have referred — which is what web/waitlist-client.js parses to draw
-- the share link and the "you're #N, invite friends to move up" copy. It still reveals
-- nothing about anyone else: a position and a total are aggregates, not identities.
drop function if exists public.join_waitlist(text, boolean, text, boolean, text);

create or replace function public.join_waitlist(
  p_email       text,
  p_attested    boolean,
  p_referred_by text  default null,
  p_source      jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email     text := lower(btrim(p_email));
  v_ref       text := lower(btrim(coalesce(p_referred_by, '')));
  v_source    jsonb := p_source;
  v_id        uuid;
  v_code      text;
  v_total     bigint;
  v_referrals bigint;
  v_position  bigint;
begin
  if p_attested is not true then
    raise exception 'attestation required' using errcode = 'P0001';
  end if;
  if v_email = ''
     or length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email' using errcode = 'P0001';
  end if;

  -- Referral is best-effort attribution, never a gate: a malformed or unknown code is
  -- discarded so a broken ?ref link can't cost someone their signup. The existence check
  -- also means a code can only be credited once it belongs to a real row.
  if v_ref = ''
     or v_ref !~ '^[a-z0-9]{6,32}$'
     or not exists (select 1 from public.waitlist where code = v_ref) then
    v_ref := null;
  end if;

  -- Cap the attribution blob. The client sends a fixed UTM allowlist capped at 200 chars
  -- each (~1.2 KB), but a direct anon caller could send anything; drop an oversized blob
  -- rather than store it.
  if v_source is not null and length(v_source::text) > 4000 then
    v_source := null;
  end if;

  insert into public.waitlist(email, attested_18_us, code, referred_by, source)
  values (v_email, true, public.gen_waitlist_code(), v_ref, v_source)
  on conflict (email) do update
    -- Idempotent: a repeat signup retrieves the same row. Attribution is first-touch —
    -- referred_by and source fill in only if they were empty, and are never overwritten,
    -- so re-submitting from a different link can't rewrite who referred you.
    set referred_by = coalesce(public.waitlist.referred_by, excluded.referred_by),
        source      = coalesce(public.waitlist.source, excluded.source)
  returning id, code into v_id, v_code;

  -- Defence in depth against a self-referral (re-joining while holding your own ?ref):
  -- a row must never refer itself, or it would inflate its own rank.
  update public.waitlist set referred_by = null
   where id = v_id and referred_by = v_code;

  select count(*) into v_total from public.waitlist;
  select count(*) into v_referrals from public.waitlist where referred_by = v_code;

  -- Rank: most referrals first, then earliest signup, then id as a stable tiebreaker.
  -- This is the whole "invite friends to move up" mechanic — each confirmed referral
  -- lifts the inviter above everyone with fewer.
  with refcounts as (
    select referred_by as code, count(*)::bigint as n
    from public.waitlist
    where referred_by is not null
    group by referred_by
  ),
  ranked as (
    select w.id,
           row_number() over (
             order by coalesce(rc.n, 0) desc, w.created_at asc, w.id asc
           ) as position
    from public.waitlist w
    left join refcounts rc on rc.code = w.code
  )
  select position into v_position from ranked where id = v_id;

  return jsonb_build_object(
    'code',      v_code,
    'position',  v_position,
    'total',     v_total,
    'referrals', v_referrals
  );
end; $$;

revoke all on function public.join_waitlist(text, boolean, text, jsonb) from public;
grant execute on function public.join_waitlist(text, boolean, text, jsonb) to anon, authenticated;

-- ── waitlist_count: the live counter ───────────────────────────────────────────
-- The single read anon is allowed. It returns a scalar total and nothing else — no row,
-- no email, no ordering — so it can power the page's live counter without ever exposing
-- who is on the list. This is why the counter is honest rather than a made-up number.
create or replace function public.waitlist_count()
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.waitlist;
$$;

revoke all on function public.waitlist_count() from public;
grant execute on function public.waitlist_count() to anon, authenticated;

comment on function public.waitlist_count() is
  'Aggregate signup total for the marketing page''s live counter. Returns a count only — never a row — so it is not an enumeration oracle.';
