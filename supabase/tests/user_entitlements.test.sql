-- supabase/tests/user_entitlements.test.sql — gap-3 TrueTone Plus entitlements
begin;
select plan(7);

insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- 1. Table structure
select has_table('public', 'user_entitlements', 'user_entitlements table exists');
select has_column('public', 'user_entitlements', 'is_plus_subscriber', 'has is_plus_subscriber');
select has_column('public', 'user_entitlements', 'subscription_tier', 'has subscription_tier');
select has_column('public', 'user_entitlements', 'stripe_customer_id', 'has stripe_customer_id');

-- 2. Service role can insert entitlement
insert into public.user_entitlements (id, is_plus_subscriber, subscription_tier, subscription_status, stripe_customer_id)
values ('11111111-1111-1111-1111-111111111111', true, 'yearly', 'active', 'cus_test123');

select is((select is_plus_subscriber from public.user_entitlements where id = '11111111-1111-1111-1111-111111111111'), true, 'service role inserted entitlement');

-- 3. RLS isolation: user 1 can view own entitlement, user 2 cannot
set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.user_entitlements where id = '11111111-1111-1111-1111-111111111111'), 1, 'user 1 sees own entitlement');

set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.user_entitlements where id = '11111111-1111-1111-1111-111111111111'), 0, 'user 2 cannot see user 1 entitlement');

reset role;
select * from finish();
rollback;
