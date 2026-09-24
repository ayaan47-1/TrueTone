-- 0021_chat_ops.sql
-- routine-chat operations + cost controls (gap-9 contract §3–§5, §7).
-- Service-role only: no anon/authenticated grants, RLS on with no policies. The edge function
-- computes the keyed user hash with a secret that never enters this database, so a client can never
-- call these RPCs to forge a key, a price, or a reservation.
-- Money is integer micro-dollars (1e-6 USD). Every check-and-write RPC takes one transaction-scoped
-- advisory lock, so competing requests cannot over-reserve.

-- Persistent cost-kill state. Survives the UTC reset; only a human re-enables (chat_ops_set_cost_killed).
create table public.chat_ops_state (
  id boolean primary key default true check (id),
  cost_killed boolean not null default false,
  kill_reason text check (kill_reason in ('global_cap', 'cost_cap_breach', 'manual')),
  changed_at timestamptz not null default now()
);
insert into public.chat_ops_state (id) values (true);

-- Audit of every kill-state change: role + reason code, never a raw admin token.
create table public.chat_ops_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_role text not null check (actor_role ~ '^[a-z_]{1,32}$'),
  reason_code text not null check (reason_code ~ '^[a-z_]{1,32}$'),
  old_state boolean not null,
  new_state boolean not null,
  incident_ref text check (incident_ref ~ '^[A-Za-z0-9._:-]{1,64}$')
);

-- All-attempts limiter (referrals and invalid requests included). Keys are keyed hashes only.
create table public.chat_attempts (
  id bigserial primary key,
  user_key text not null check (user_key ~ '^[0-9a-f]{64}$'),
  ip_key text check (ip_key ~ '^[0-9a-f]{64}$'),
  at timestamptz not null default now()
);
create index chat_attempts_user_at on public.chat_attempts (user_key, at);
create index chat_attempts_ip_at on public.chat_attempts (ip_key, at);

-- One row per provider-eligible call: the concurrency lease and the daily cost ledger.
-- user_id exists only so account deletion cascades to the linkable usage events.
create table public.chat_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_key text not null check (user_key ~ '^[0-9a-f]{64}$'),
  reserved_micros bigint not null check (reserved_micros > 0),
  actual_micros bigint check (actual_micros >= 0),
  state text not null default 'in_flight' check (state in ('in_flight', 'settled')),
  created_at timestamptz not null default now(),
  utc_day date not null default (now() at time zone 'utc')::date,
  settled_at timestamptz
);
create index chat_reservations_user_day on public.chat_reservations (user_key, utc_day);
create index chat_reservations_day on public.chat_reservations (utc_day);

-- Immutable numeric usage event (§4). No text, raw identifier, image, header, or error body column.
create table public.chat_usage_events (
  event_id uuid primary key,
  reservation_id uuid not null unique references public.chat_reservations (id) on delete cascade,
  request_id uuid not null,
  occurred_at timestamptz not null,
  environment text not null check (environment ~ '^[A-Za-z0-9._:-]{1,64}$'),
  function_revision text not null check (function_revision ~ '^[A-Za-z0-9._:-]{1,64}$'),
  config_revision text not null check (config_revision ~ '^[A-Za-z0-9._:-]{1,64}$'),
  user_key text not null check (user_key ~ '^[0-9a-f]{64}$'),
  model_id text not null check (model_id ~ '^[a-z0-9.-]{1,64}$'),
  model_pricing_revision text not null check (model_pricing_revision ~ '^[A-Za-z0-9._:-]{1,64}$'),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cache_creation_input_tokens integer check (cache_creation_input_tokens >= 0),
  cache_read_input_tokens integer check (cache_read_input_tokens >= 0),
  usage_status text not null check (usage_status in ('ok', 'usage_unavailable')),
  estimated_cost_usd numeric(12, 6) not null check (estimated_cost_usd >= 0),
  reserved_cost_usd numeric(12, 6) not null check (reserved_cost_usd >= 0),
  reservation_released_usd numeric(12, 6) not null check (reservation_released_usd >= 0),
  outcome text not null check (outcome in ('success', 'provider_error', 'output_blocked', 'cost_cap_breach')),
  http_status integer not null check (http_status between 100 and 599),
  latency_ms integer not null check (latency_ms >= 0),
  guard_reason text check (guard_reason ~ '^[a-z_]{1,32}$'),
  provider_request_attempted boolean not null,
  check (usage_status = 'usage_unavailable' or (input_tokens is not null and output_tokens is not null))
);
create index chat_usage_events_occurred on public.chat_usage_events (occurred_at);

create or replace function public.chat_usage_events_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'chat_usage_events is append-only' using errcode = 'P0001';
end; $$;
create trigger chat_usage_events_no_update before update on public.chat_usage_events
  for each row execute function public.chat_usage_events_immutable();

-- De-identified daily aggregate kept 13 months (§7.2). No user key.
create table public.chat_usage_daily (
  utc_day date not null,
  environment text not null,
  model_id text not null,
  config_revision text not null,
  model_pricing_revision text not null,
  provider_calls integer not null,
  output_blocked integer not null,
  provider_errors integer not null,
  input_tokens bigint not null,
  output_tokens bigint not null,
  estimated_cost_usd numeric(14, 6) not null,
  reserved_cost_usd numeric(14, 6) not null,
  primary key (utc_day, environment, model_id, config_revision, model_pricing_revision)
);

alter table public.chat_ops_state enable row level security;
alter table public.chat_ops_audit enable row level security;
alter table public.chat_attempts enable row level security;
alter table public.chat_reservations enable row level security;
alter table public.chat_usage_events enable row level security;
alter table public.chat_usage_daily enable row level security;
revoke all on public.chat_ops_state, public.chat_ops_audit, public.chat_attempts,
  public.chat_reservations, public.chat_usage_events, public.chat_usage_daily from anon, authenticated;

-- Seconds until the next 00:00 UTC.
create or replace function public.chat_secs_to_utc_midnight()
returns integer language sql stable as $$
  select greatest(1, ceil(extract(epoch from
    (date_trunc('day', now() at time zone 'utc') + interval '1 day') - (now() at time zone 'utc')))::int);
$$;

-- All-attempts + hashed-IP limiter over a rolling 10 minutes. A rejected attempt is not recorded.
create or replace function public.chat_note_attempt(
  p_user_key text, p_ip_key text, p_user_max integer, p_ip_max integer)
returns table (allowed boolean, retry_after_s integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_oldest timestamptz; v_n integer;
begin
  perform pg_advisory_xact_lock(hashtext('chat_ops'));
  select count(*), min(at) into v_n, v_oldest from public.chat_attempts
    where user_key = p_user_key and at > now() - interval '10 minutes';
  if v_n >= p_user_max then
    return query select false, greatest(1, ceil(extract(epoch from v_oldest + interval '10 minutes' - now()))::int);
    return;
  end if;
  if p_ip_key is not null then
    select count(*), min(at) into v_n, v_oldest from public.chat_attempts
      where ip_key = p_ip_key and at > now() - interval '10 minutes';
    if v_n >= p_ip_max then
      return query select false, greatest(1, ceil(extract(epoch from v_oldest + interval '10 minutes' - now()))::int);
      return;
    end if;
  end if;
  insert into public.chat_attempts (user_key, ip_key) values (p_user_key, p_ip_key);
  return query select true, 0;
end; $$;

-- Atomic reservation: kill state, one in-flight lease, short window, user day, global day (§3.2–§3.4).
-- An in-flight lease older than 120 s no longer blocks concurrency but still counts its full cost.
create or replace function public.chat_reserve(
  p_user_id uuid, p_user_key text, p_request_id uuid, p_reserve_micros bigint,
  p_short_window_max integer, p_user_daily_calls integer, p_user_daily_micros bigint,
  p_global_daily_micros bigint)
returns table (status text, reservation_id uuid, retry_after_s integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_n integer; v_oldest timestamptz; v_spent bigint; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('chat_ops'));
  if (select cost_killed from public.chat_ops_state where id) then
    return query select 'cost_killed', null::uuid, 0; return;
  end if;
  if exists (select 1 from public.chat_reservations where user_key = p_user_key
             and state = 'in_flight' and created_at > now() - interval '120 seconds') then
    return query select 'concurrency', null::uuid, 5; return;
  end if;
  select count(*), min(created_at) into v_n, v_oldest from public.chat_reservations
    where user_key = p_user_key and created_at > now() - interval '10 minutes';
  if v_n >= p_short_window_max then
    return query select 'rate', null::uuid,
      greatest(1, ceil(extract(epoch from v_oldest + interval '10 minutes' - now()))::int);
    return;
  end if;
  select count(*), coalesce(sum(coalesce(actual_micros, reserved_micros)), 0) into v_n, v_spent
    from public.chat_reservations where user_key = p_user_key and utc_day = v_today;
  if v_n + 1 > p_user_daily_calls or v_spent + p_reserve_micros > p_user_daily_micros then
    return query select 'user_daily', null::uuid, public.chat_secs_to_utc_midnight(); return;
  end if;
  select coalesce(sum(coalesce(actual_micros, reserved_micros)), 0) into v_spent
    from public.chat_reservations where utc_day = v_today;
  if v_spent + p_reserve_micros > p_global_daily_micros then
    perform public.chat_set_kill_state(true, 'global_cap', 'system', null);
    return query select 'cost_killed', null::uuid, 0; return;
  end if;
  insert into public.chat_reservations (request_id, user_id, user_key, reserved_micros, utc_day)
    values (p_request_id, p_user_id, p_user_key, p_reserve_micros, v_today) returning id into v_id;
  return query select 'ok', v_id, 0;
end; $$;

-- Settle: persist the usage event, then release the unused reservation (same transaction).
create or replace function public.chat_settle(
  p_reservation_id uuid, p_actual_micros bigint, p_breach boolean, p_event jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext('chat_ops'));
  update public.chat_reservations set state = 'settled', actual_micros = p_actual_micros, settled_at = now()
    where id = p_reservation_id and state = 'in_flight';
  if not found then raise exception 'reservation not in flight' using errcode = 'P0001'; end if;
  -- Explicit column extraction: unknown keys in p_event are ignored, never stored.
  insert into public.chat_usage_events (
    event_id, reservation_id, request_id, occurred_at, environment, function_revision, config_revision,
    user_key, model_id, model_pricing_revision, input_tokens, output_tokens,
    cache_creation_input_tokens, cache_read_input_tokens, usage_status, estimated_cost_usd,
    reserved_cost_usd, reservation_released_usd, outcome, http_status, latency_ms, guard_reason,
    provider_request_attempted)
  values (
    (p_event->>'event_id')::uuid, p_reservation_id, (p_event->>'request_id')::uuid,
    (p_event->>'occurred_at')::timestamptz, p_event->>'environment', p_event->>'function_revision',
    p_event->>'config_revision', p_event->>'user_key', p_event->>'model_id',
    p_event->>'model_pricing_revision', (p_event->>'input_tokens')::int, (p_event->>'output_tokens')::int,
    (p_event->>'cache_creation_input_tokens')::int, (p_event->>'cache_read_input_tokens')::int,
    p_event->>'usage_status', (p_event->>'estimated_cost_usd')::numeric,
    (p_event->>'reserved_cost_usd')::numeric, (p_event->>'reservation_released_usd')::numeric,
    p_event->>'outcome', (p_event->>'http_status')::int, (p_event->>'latency_ms')::int,
    p_event->>'guard_reason', (p_event->>'provider_request_attempted')::boolean);
  if p_breach then
    perform public.chat_set_kill_state(true, 'cost_cap_breach', 'system', null);
  end if;
end; $$;

-- The only way to change the kill state; always audited. Re-enable is a human operator action.
create or replace function public.chat_set_kill_state(
  p_killed boolean, p_reason text, p_actor_role text, p_incident_ref text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old boolean;
begin
  select cost_killed into v_old from public.chat_ops_state where id for update;
  update public.chat_ops_state
     set cost_killed = p_killed,
         kill_reason = case when p_killed then coalesce(kill_reason, case when p_reason in ('global_cap', 'cost_cap_breach') then p_reason else 'manual' end) else null end,
         changed_at = now()
   where id;
  insert into public.chat_ops_audit (actor_role, reason_code, old_state, new_state, incident_ref)
    values (p_actor_role, p_reason, v_old, p_killed, p_incident_ref);
end; $$;

-- Retention (§7.2): roll settled events into the de-identified daily aggregate, then delete linkable
-- rows older than 30 days; delete aggregates older than 13 months. Account deletion cascades
-- auth.users → chat_reservations → chat_usage_events.
create or replace function public.chat_ops_retention_sweep()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext('chat_ops'));
  insert into public.chat_usage_daily as d
  select (occurred_at at time zone 'utc')::date, environment, model_id, config_revision, model_pricing_revision,
         count(*), count(*) filter (where outcome = 'output_blocked'),
         count(*) filter (where outcome = 'provider_error'),
         coalesce(sum(input_tokens), 0), coalesce(sum(output_tokens), 0),
         sum(estimated_cost_usd), sum(reserved_cost_usd)
    from public.chat_usage_events
   where occurred_at < now() - interval '30 days'
   group by 1, 2, 3, 4, 5
  on conflict (utc_day, environment, model_id, config_revision, model_pricing_revision) do update set
    provider_calls = d.provider_calls + excluded.provider_calls,
    output_blocked = d.output_blocked + excluded.output_blocked,
    provider_errors = d.provider_errors + excluded.provider_errors,
    input_tokens = d.input_tokens + excluded.input_tokens,
    output_tokens = d.output_tokens + excluded.output_tokens,
    estimated_cost_usd = d.estimated_cost_usd + excluded.estimated_cost_usd,
    reserved_cost_usd = d.reserved_cost_usd + excluded.reserved_cost_usd;
  delete from public.chat_reservations where created_at < now() - interval '30 days';
  delete from public.chat_attempts where at < now() - interval '1 day';
  delete from public.chat_usage_daily where utc_day < (now() at time zone 'utc')::date - interval '13 months';
end; $$;

revoke all on function public.chat_secs_to_utc_midnight() from public;
revoke all on function public.chat_note_attempt(text, text, integer, integer) from public;
revoke all on function public.chat_reserve(uuid, text, uuid, bigint, integer, integer, bigint, bigint) from public;
revoke all on function public.chat_settle(uuid, bigint, boolean, jsonb) from public;
revoke all on function public.chat_set_kill_state(boolean, text, text, text) from public;
revoke all on function public.chat_ops_retention_sweep() from public;
grant execute on function public.chat_note_attempt(text, text, integer, integer) to service_role;
grant execute on function public.chat_reserve(uuid, text, uuid, bigint, integer, integer, bigint, bigint) to service_role;
grant execute on function public.chat_settle(uuid, bigint, boolean, jsonb) to service_role;
grant execute on function public.chat_set_kill_state(boolean, text, text, text) to service_role;

select cron.schedule('truetone-chat-ops-retention', '15 3 * * *',
  $$ select public.chat_ops_retention_sweep(); $$);
