-- Orders are written only server-side (migration 0025). A signed-in user may read their own
-- orders but can no longer INSERT/UPDATE/DELETE them, so they cannot forge status='succeeded'.
-- Only service_role (create-payment-intent inserts 'pending'; stripe-webhook sets paid status)
-- writes this table.
begin;
select plan(13);

-- grants: clients are read-only
select ok(not has_table_privilege('authenticated', 'public.orders', 'INSERT'), 'authenticated has no INSERT on orders');
select ok(not has_table_privilege('authenticated', 'public.orders', 'UPDATE'), 'authenticated has no UPDATE on orders');
select ok(not has_table_privilege('authenticated', 'public.orders', 'DELETE'), 'authenticated has no DELETE on orders');
select ok(not has_table_privilege('anon', 'public.orders', 'INSERT'), 'anon has no INSERT on orders');
select ok(not has_table_privilege('anon', 'public.orders', 'UPDATE'), 'anon has no UPDATE on orders');
select ok(has_table_privilege('authenticated', 'public.orders', 'SELECT'), 'authenticated keeps SELECT on orders');
select policies_are('public', 'orders', array['Users can view their own orders'],
  'the client INSERT policy is gone; only the own-rows SELECT policy remains');

-- status is a closed set
select throws_ok(
  $$ insert into public.orders(user_id, stripe_payment_intent_id, amount, status, items)
     values (gen_random_uuid(), 'pi_bad_status', 100, 'shipped', '[]') $$,
  '23514', null, 'status outside pending/succeeded/failed is rejected');

-- server-side path (service_role) still works
insert into auth.users(id) values ('11111111-1111-1111-1111-111111111111');
set local role service_role;
select lives_ok(
  $$ insert into public.orders(user_id, stripe_payment_intent_id, amount, status, items)
     values ('11111111-1111-1111-1111-111111111111', 'pi_server', 2500, 'pending', '[]') $$,
  'service_role can insert a pending order');
select lives_ok(
  $$ update public.orders set status = 'succeeded' where stripe_payment_intent_id = 'pi_server' $$,
  'service_role (stripe-webhook) can mark an order succeeded');
reset role;

-- act as the owning user
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok(
  $$ insert into public.orders(user_id, stripe_payment_intent_id, amount, status, items)
     values ('11111111-1111-1111-1111-111111111111', 'pi_forged', 1, 'succeeded', '[]') $$,
  '42501', null, 'a user cannot forge a succeeded order via PostgREST');
select throws_ok(
  $$ update public.orders set status = 'succeeded', amount = 1 where stripe_payment_intent_id = 'pi_server' $$,
  '42501', null, 'a user cannot change status/amount of their own order');
select is(
  (select count(*) from public.orders where stripe_payment_intent_id = 'pi_server')::int,
  1, 'a user can still read their own order');

select * from finish();
rollback;
