-- supabase/migrations/0016_waitlist_sms.sql
-- Optional phone capture + TCPA consent proof for the pre-launch waitlist.
--
-- CAN-SPAM governs the email list; TCPA governs texts, and it is a different animal:
-- $500-$1,500 per message, uncapped, with a private right of action. Marketing texts need
-- prior express written consent — a clear disclosure plus an affirmative act specific to
-- SMS — so this migration stores not just the number but proof of what was agreed and when.
--
-- Nothing here sends anything. sms_invited_at and the 'sent' event type are seams for a
-- later project; no code writes them yet.

-- ── live state on the waitlist row ────────────────────────────────────────────
alter table public.waitlist
  add column phone               text,
  add column sms_consent_at      timestamptz,
  add column sms_consent_version text,
  add column sms_invited_at      timestamptz;

-- E.164, US only. A plain ^\+1[2-9][0-9]{2}[2-9][0-9]{6}$ would accept +19115550100:
-- N11 codes are assignable as neither area code nor exchange, so exclude them explicitly.
alter table public.waitlist add constraint waitlist_phone_e164 check (
  phone is null or (
    phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
    and substring(phone from 3 for 3) !~ '^[2-9]11$'
    and substring(phone from 6 for 3) !~ '^[2-9]11$'
  )
);

-- A stored number and a consent record are inseparable: there is no path to a textable
-- number with no proof behind it.
alter table public.waitlist add constraint waitlist_phone_consent_paired
  check (num_nonnulls(phone, sms_consent_at, sms_consent_version) in (0, 3));

-- Partial: many rows have no phone, but no number is ever stored twice.
create unique index waitlist_phone_key on public.waitlist(phone) where phone is not null;

-- ── the exact wording that was consented to ───────────────────────────────────
-- Kept in the database, not only in the repo, so it is reconstructable from a dump alone —
-- which is the artifact that would actually be handed to counsel.
create table public.waitlist_sms_consent_versions (
  version    text primary key,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ASCII only. A curly apostrophe or en-dash here breaks the byte-for-byte drift test and
-- forces any SMS carrying this text into UCS-2 (160 -> 70 characters per segment).
insert into public.waitlist_sms_consent_versions(version, body) values (
  'sms-2026-08-07',
  'Text me when TrueTone launches. ~1-2 messages. Msg & data rates may apply. Reply STOP to opt out. Consent isn''t required to join.'
);

alter table public.waitlist add constraint waitlist_sms_consent_version_fk
  foreign key (sms_consent_version) references public.waitlist_sms_consent_versions(version);

revoke all on public.waitlist_sms_consent_versions from anon, authenticated, service_role;
grant select on public.waitlist_sms_consent_versions to service_role;

-- ── the pepper ────────────────────────────────────────────────────────────────
-- Generated here rather than deployed by hand: a pepper that must be set manually after
-- deploy is one that will eventually be missing, at which point join_waitlist either
-- breaks signups or silently skips the log.
--
-- No grants to anyone. Only the table owner can read it, which is exactly what a
-- security-definer function runs as. Supabase Vault would add encryption at rest, but it
-- buys nothing against the threat this defends: anyone holding a full dump already has
-- waitlist.phone in plaintext. This defends a leak of the event log on its own.
create table public.waitlist_secrets (
  name  text primary key,
  value text not null
);
alter table public.waitlist_secrets enable row level security;
revoke all on public.waitlist_secrets from anon, authenticated, service_role;

insert into public.waitlist_secrets(name, value)
values ('sms_pepper', encode(gen_random_bytes(32), 'hex'));

-- ── the consent event log ─────────────────────────────────────────────────────
-- Survives unsubscribe and holds no phone number, so an opt-out does not erase the proof
-- that consent existed. Given a claimant's number you can hash it and find the receipt.
create table public.waitlist_sms_events (
  id              uuid primary key default gen_random_uuid(),
  phone_hash      text     not null,
  -- so a rotated (or wrongly restored) pepper does not silently render every existing
  -- hash unverifiable at exactly the moment they are needed
  pepper_version  smallint not null default 1,
  event           text     not null check (event in ('granted', 'revoked', 'sent')),
  consent_version text,
  created_at      timestamptz not null default now()
);
create index waitlist_sms_events_hash_idx on public.waitlist_sms_events(phone_hash);

revoke all on public.waitlist_sms_events from anon, authenticated, service_role;
grant select on public.waitlist_sms_events to service_role;

-- Append-only, and stricter than consent_log: there is no identity to null out, so both
-- UPDATE and DELETE always raise. The single exception is waitlist_retention_sweep(),
-- which sets app.waitlist_sweep for the duration of its transaction (see 0016 below).
create or replace function public.block_waitlist_sms_event_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('app.waitlist_sweep', true), '') = 'on' then
    return old;
  end if;
  raise exception 'waitlist_sms_events is append-only' using errcode = 'P0001';
end;
$$;

create trigger waitlist_sms_events_no_update
  before update on public.waitlist_sms_events
  for each row execute function public.block_waitlist_sms_event_mutation();
create trigger waitlist_sms_events_no_delete
  before delete on public.waitlist_sms_events
  for each row execute function public.block_waitlist_sms_event_mutation();

-- The wording is a legal record too.
create or replace function public.block_consent_version_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'waitlist_sms_consent_versions is append-only' using errcode = 'P0001';
end;
$$;

create trigger waitlist_sms_consent_versions_no_update
  before update on public.waitlist_sms_consent_versions
  for each row execute function public.block_consent_version_mutation();
create trigger waitlist_sms_consent_versions_no_delete
  before delete on public.waitlist_sms_consent_versions
  for each row execute function public.block_consent_version_mutation();

-- ── helpers ───────────────────────────────────────────────────────────────────
-- Normalising server-side rather than trusting the browser: otherwise dedup depends on
-- the client having done its job, and a client that did not normalise gets a confusing
-- rejection from the CHECK constraint. The constraint is the backstop, not the enforcement.
create or replace function public.normalize_us_phone(p_raw text)
returns text
language plpgsql immutable
as $$
declare v_digits text;
begin
  if p_raw is null then return null; end if;
  v_digits := regexp_replace(p_raw, '[^0-9]', '', 'g');
  -- 11 digits starting with 1 means the country code was included
  if length(v_digits) = 11 and left(v_digits, 1) = '1' then
    v_digits := substring(v_digits from 2);
  end if;
  if length(v_digits) <> 10 then return null; end if;
  -- NANP, not just digit-counting: area code and exchange must each start 2-9, and
  -- neither may be an N11 service code. Enforced here, not left to the CHECK below, so
  -- an unusable number is reported as our own P0001 in join_waitlist rather than escaping
  -- as a raw 23514 constraint violation (PostgREST forwards the DETAIL to the browser).
  -- This also keeps the CHECK a pure backstop, matching the comment at its call site, and
  -- keeps the server in exact agreement with the client-side parsePhone, which applies the
  -- same NANP rules.
  if v_digits !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' then return null; end if;
  if substring(v_digits from 1 for 3) ~ '^[2-9]11$' then return null; end if;
  if substring(v_digits from 4 for 3) ~ '^[2-9]11$' then return null; end if;
  return '+1' || v_digits;
end;
$$;

-- security definer so it can read waitlist_secrets, which has no grants at all.
create or replace function public.waitlist_phone_hash(p_phone text)
returns text
language plpgsql
security definer set search_path = public, extensions, pg_temp
as $$
declare v_pepper text;
begin
  select value into v_pepper from public.waitlist_secrets where name = 'sms_pepper';
  if v_pepper is null then
    -- Fail loudly. Hashing with an empty pepper would produce brute-forceable digests
    -- that look identical to good ones.
    raise exception 'waitlist sms pepper missing' using errcode = 'P0001';
  end if;
  return encode(extensions.hmac(p_phone, v_pepper, 'sha256'), 'hex');
end;
$$;

revoke all on function public.normalize_us_phone(text) from public;
revoke all on function public.waitlist_phone_hash(text) from public;

-- ── join_waitlist, replaced ───────────────────────────────────────────────────
-- Dropped and recreated rather than overloaded: with both a 2-arg and a 5-arg signature
-- present, PostgREST answers PGRST203 for a two-key call instead of choosing. The defaults
-- make deploy order irrelevant — a visitor holding a cached copy of the old app.js sends
-- two keys, hits the defaults, and still joins. .pages.dev caches aggressively.
drop function if exists public.join_waitlist(text, boolean);

create or replace function public.join_waitlist(
  p_email               text,
  p_attested            boolean,
  p_phone               text    default null,
  p_sms_consent         boolean default false,
  p_sms_consent_version text    default null
)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email  text := lower(btrim(p_email));
  v_phone  text;
  v_stored text;
begin
  if p_attested is not true then
    raise exception 'attestation required' using errcode = 'P0001';
  end if;
  if v_email is null
     or length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email' using errcode = 'P0001';
  end if;

  -- Consent is what makes a number storable. No tick, no number — and discarding rather
  -- than rejecting means a stray digit in an optional field never costs someone their
  -- email signup.
  if p_sms_consent is true and p_phone is not null and btrim(p_phone) <> '' then
    v_phone := public.normalize_us_phone(p_phone);
    if v_phone is null then
      -- Raise here: silently dropping would leave them believing a text is coming.
      raise exception 'invalid phone' using errcode = 'P0001';
    end if;
    if p_sms_consent_version is null then
      raise exception 'consent version required' using errcode = 'P0001';
    end if;
    -- Validated explicitly, up front, rather than left to the sms_consent_version FK: the
    -- FK is an AFTER-ROW trigger, so it fires after index insertion. That means a phone
    -- unique_violation (caught below) pre-empts the FK violation whenever the candidate
    -- number is already on the list, while a garbage version on a number that is NOT on
    -- the list still reaches the FK and raises. Those two outcomes are a distinct SQLSTATE
    -- and a distinct HTTP status over the live anon RPC — a structural phone (and email)
    -- oracle: send any junk version with a candidate number and a throwaway email, and
    -- 204-vs-409 reveals whether that number is already on the waitlist. Checking here,
    -- before either insert is attempted, makes the outcome state-independent. Do NOT widen
    -- the exception handler below to catch foreign_key_violation instead — that would make
    -- forged versions succeed while silently storing nothing, which is worse.
    if not exists (
      select 1 from public.waitlist_sms_consent_versions where version = p_sms_consent_version
    ) then
      raise exception 'unknown consent version' using errcode = '23503';
    end if;
  end if;

  begin
    insert into public.waitlist(email, attested_18_us, phone, sms_consent_at, sms_consent_version)
    values (
      v_email, true, v_phone,
      case when v_phone is null then null else now() end,
      case when v_phone is null then null else p_sms_consent_version end
    )
    on conflict (email) do update
      set phone               = excluded.phone,
          sms_consent_at      = excluded.sms_consent_at,
          sms_consent_version = excluded.sms_consent_version
      -- Only upgrade a row that has no number. Without this, anyone who knows your
      -- address could replace your number with theirs.
      where public.waitlist.phone is null and excluded.phone is not null
    returning phone into v_stored;
  exception when unique_violation then
    -- The number is already on the list under a different address. Store the email alone;
    -- anything else would confirm the number is present.
    insert into public.waitlist(email, attested_18_us) values (v_email, true)
    on conflict (email) do nothing;
    v_stored := null;
  end;

  -- Only a confirmed write produces a receipt. Logging on intent instead would record
  -- consent to text a number we never stored and cannot reach.
  if v_stored is not null then
    insert into public.waitlist_sms_events(phone_hash, event, consent_version)
    values (public.waitlist_phone_hash(v_stored), 'granted', p_sms_consent_version);
  end if;
end; $$;

revoke all on function public.join_waitlist(text, boolean, text, boolean, text) from public;
grant execute on function public.join_waitlist(text, boolean, text, boolean, text)
  to anon, authenticated;
