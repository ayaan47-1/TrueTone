-- supabase/tests/chat_quota.test.sql
-- pgTAP coverage for migration 0042_chat_quota (MASVS M3): per-user daily routine-chat limit.
begin;
select plan(9);

insert into auth.users(id) values
  ('c4a70000-0000-0000-0000-000000000001'), ('c4a70000-0000-0000-0000-000000000002');

select ok(
  not has_function_privilege('anon', 'public.consume_chat_quota()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.consume_chat_quota()', 'EXECUTE'),
  'only authenticated can execute consume_chat_quota');
select ok(
  not has_table_privilege('authenticated', 'public.chat_usage', 'SELECT')
  and not has_table_privilege('authenticated', 'public.chat_usage', 'INSERT')
  and not has_table_privilege('authenticated', 'public.chat_usage', 'UPDATE'),
  'clients cannot read or write chat_usage directly');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c4a70000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(public.consume_chat_quota(), true, 'first call is allowed');
select is((select count(*)::int from generate_series(2, 50) g where public.consume_chat_quota()), 49,
  'calls 2..50 are allowed');
select is(public.consume_chat_quota(), false, 'call 51 is refused');

set local request.jwt.claims = '{"sub":"c4a70000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(public.consume_chat_quota(), true, 'another user has their own quota');

reset role;
select is((select calls from public.chat_usage where user_id = 'c4a70000-0000-0000-0000-000000000001'), 50,
  'a refused call does not increase the counter');

-- UTC day rollover (Toby round 2): move user 1's exhausted counter to yesterday; today's first
-- call is allowed again and the old day's row is dropped.
update public.chat_usage set day = (now() at time zone 'utc')::date - 1
 where user_id = 'c4a70000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"c4a70000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(public.consume_chat_quota(), true, 'a new UTC day resets the quota');
reset role;
select is(
  (select array_agg(calls order by day) from public.chat_usage where user_id = 'c4a70000-0000-0000-0000-000000000001'),
  array[1], 'yesterday''s counter is dropped and today starts at 1');

select * from finish();
rollback;
