-- supabase/migrations/0042_chat_quota.sql
-- MASVS M3: per-user daily call limit for the routine-chat Edge Function, so one account cannot run
-- up the model bill. The counter holds only (user id, UTC day, count) -- no chat content. Clients
-- cannot read or write it directly; the function's JWT-scoped client calls consume_chat_quota().
create table public.chat_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  calls integer not null default 0 check (calls >= 0),
  primary key (user_id, day)
);
alter table public.chat_usage enable row level security;
revoke all on table public.chat_usage from anon, authenticated;

-- Atomically counts one call for the caller. Returns false (and counts nothing more) once the
-- caller has reached the daily limit. Old days are dropped for the caller on each call.
create or replace function public.consume_chat_quota()
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_limit constant integer := 50;
  v_calls integer;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;

  delete from public.chat_usage where user_id = v_uid and day < (now() at time zone 'utc')::date;

  insert into public.chat_usage(user_id, day, calls)
    values (v_uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set calls = public.chat_usage.calls + 1
    where public.chat_usage.calls < v_limit
  returning calls into v_calls;

  return v_calls is not null;
end; $$;

revoke all on function public.consume_chat_quota() from public;
revoke execute on function public.consume_chat_quota() from anon;
grant execute on function public.consume_chat_quota() to authenticated;
