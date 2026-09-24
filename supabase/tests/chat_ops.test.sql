-- supabase/tests/chat_ops.test.sql — gap-9 atomic quota/cost store (0021_chat_ops.sql).
begin;
select plan(14);

insert into auth.users(id) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
-- user keys are 64-hex keyed hashes (the edge function computes them; the DB never sees the raw id)

-- clients cannot reach the store
set local role authenticated;
select throws_ok($$ select * from public.chat_reserve('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', gen_random_uuid(), 20000, 5, 20, 400000, 25000000) $$,
  '42501', NULL, 'authenticated cannot call chat_reserve');
select throws_ok($$ select * from public.chat_usage_events $$, '42501', NULL, 'authenticated cannot read usage events');
reset role;

-- first reservation succeeds; a competing one for the same user is a concurrency reject
select is((select status from public.chat_reserve('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', repeat('a', 64),
  '00000000-0000-0000-0000-000000000001', 20000, 5, 20, 400000, 25000000)), 'ok', 'reservation ok');
select is((select status from public.chat_reserve('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', repeat('a', 64),
  '00000000-0000-0000-0000-000000000002', 20000, 5, 20, 400000, 25000000)), 'concurrency', 'one in flight per user');

-- settle at the 3000/600 ceiling: actual $0.0180 charged, event persisted
select lives_ok($$ select public.chat_settle(
  (select id from public.chat_reservations where request_id = '00000000-0000-0000-0000-000000000001'), 18000, false,
  jsonb_build_object('event_id', gen_random_uuid(), 'request_id', '00000000-0000-0000-0000-000000000001',
    'occurred_at', now(), 'environment', 'test', 'function_revision', 'fn-1', 'config_revision', 'cfg-1',
    'user_key', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'model_id', 'claude-sonnet-4-6',
    'model_pricing_revision', 'p-1', 'input_tokens', 3000, 'output_tokens', 600, 'cache_creation_input_tokens', 0,
    'cache_read_input_tokens', 0, 'usage_status', 'ok', 'estimated_cost_usd', '0.018000', 'reserved_cost_usd', '0.020000',
    'reservation_released_usd', '0.002000', 'outcome', 'success', 'http_status', 200, 'latency_ms', 10,
    'guard_reason', null, 'provider_request_attempted', true, 'message', 'must be ignored')) $$, 'settle persists event');
select is((select actual_micros from public.chat_reservations where request_id = '00000000-0000-0000-0000-000000000001'),
  18000::bigint, 'unused $0.0020 released');
select is((select count(*)::int from public.chat_usage_events), 1, 'exactly one usage event');
select throws_ok($$ update public.chat_usage_events set latency_ms = 0 $$, 'P0001', NULL, 'usage events are immutable');
select throws_ok($$ select public.chat_settle((select id from public.chat_reservations limit 1), 1, false, '{}'::jsonb) $$,
  'P0001', NULL, 'a settled reservation cannot be settled twice');

-- global cap: $0.018 + $24.98 already spent today; a further $0.02 reservation would exceed $25.00 → kill
insert into public.chat_reservations (request_id, user_id, user_key, reserved_micros, actual_micros, state)
  values (gen_random_uuid(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', repeat('b', 64), 24980000, 24980000, 'settled');
select is((select status from public.chat_reserve('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', repeat('a', 64),
  '00000000-0000-0000-0000-000000000003', 20000, 5, 20, 400000, 25000000)), 'cost_killed', 'global cap denies and kills');
select is((select cost_killed from public.chat_ops_state), true, 'cost kill persisted');
select is((select count(*)::int from public.chat_ops_audit where reason_code = 'global_cap'), 1, 'kill audited');

-- retention: 31-day-old linkable rows roll up into the de-identified aggregate and are deleted
update public.chat_reservations set created_at = now() - interval '31 days';
alter table public.chat_usage_events disable trigger chat_usage_events_no_update;
update public.chat_usage_events set occurred_at = now() - interval '31 days';
alter table public.chat_usage_events enable trigger chat_usage_events_no_update;
select public.chat_ops_retention_sweep();
select is((select count(*)::int from public.chat_usage_events), 0, '31-day linkable events deleted');
select is((select provider_calls from public.chat_usage_daily limit 1), 1, 'de-identified aggregate retained');

select * from finish();
rollback;
