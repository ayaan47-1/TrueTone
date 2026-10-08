begin;
select plan(11);

insert into auth.users(id) values ('28282828-2828-2828-2828-282828282828');
insert into public.profiles(id, is_18_plus, consent_active) values
  ('28282828-2828-2828-2828-282828282828', true, true);
insert into public.consent_log(user_id, action, policy_version, policy_doc_key) values
  ('28282828-2828-2828-2828-282828282828', 'consented', '2026-06-15.1', 'biometric');

set local role anon;
select throws_ok($$ select public.has_current_scan_consent() $$, '42501', null,
  'anon cannot execute the current-consent RPC');
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"28282828-2828-2828-2828-282828282828","role":"authenticated"}';

select is(public.has_current_scan_consent(), false,
  'an old biometric receipt is not current consent');
select throws_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1')
$$, 'P0001', null, 'record_scan rejects an old biometric receipt');
select throws_ok($$ select public.record_ai_consent() $$, 'P0001', null,
  'record_ai_consent rejects an old biometric prerequisite receipt');

select lives_ok($$ select public.record_consent() $$,
  'the caller can accept the server-current biometric policy');
select is(public.has_current_scan_consent(), true,
  'the new biometric receipt is current consent');
select lives_ok($$
  select public.record_scan(
    '{"hydration":0.5,"oiliness":0.5,"texture":0.5,"pores":0.5,"darkSpots":0.5,"redness":0.5,"fineLines":0.5,"darkCircles":0.5}'::jsonb,
    'combination', 'stub-1', true, '{"version":"skincare-1","am":[],"pm":[]}'::jsonb, 'skincare-1')
$$, 'record_scan accepts a current biometric receipt');
select lives_ok($$ select public.record_ai_consent() $$,
  'record_ai_consent accepts a current biometric prerequisite receipt');
select is(
  (select ai_consent_active from public.profiles
    where id='28282828-2828-2828-2828-282828282828'),
  true, 'AI consent activates only after current biometric consent');
select is(
  (select count(*) from public.consent_log
    where user_id='28282828-2828-2828-2828-282828282828'
      and action='consented' and policy_doc_key='biometric')::int,
  2, 're-consent appends the current receipt and preserves the old one');
select is(
  (select count(*) from public.scans
    where user_id='28282828-2828-2828-2828-282828282828')::int,
  1, 'only the scan after current consent is recorded');

select * from finish();
rollback;
