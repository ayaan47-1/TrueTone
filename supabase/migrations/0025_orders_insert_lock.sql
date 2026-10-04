-- 0025_orders_insert_lock.sql
-- Security fix (audit 2026-10-04, MEDIUM-1): a signed-in user could INSERT straight into
-- public.orders through PostgREST with any status/amount and forge status='succeeded'.
--
-- From here on orders are written ONLY server-side, by service_role:
--   * create-payment-intent inserts the 'pending' row with the server-computed amount;
--   * stripe-webhook (signature-verified) is the only path that sets 'succeeded'/'failed'.
-- Clients keep read access to their own rows via the existing SELECT policy.
--
-- Forward-only: 0020_orders.sql is left untouched.

-- 1. Clients become read-only. Supabase's default privileges also hand anon/authenticated
--    UPDATE/DELETE/TRUNCATE on new public tables, so revoke every write privilege, not just INSERT.
revoke insert, update, delete, truncate, references, trigger on public.orders from authenticated, anon;
revoke all on public.orders from anon;
grant select on public.orders to authenticated;

-- 2. The client INSERT policy no longer applies to anyone; drop it so it can't be re-granted by accident.
drop policy if exists "Users can insert their own orders" on public.orders;

-- 3. Status is a closed set. NOT VALID: enforced for every new/updated row without failing the
--    migration on a pre-existing (e.g. forged) row. FOLLOW-UP before relying on order history:
--    reconcile existing 'succeeded' rows against Stripe, then
--    `alter table public.orders validate constraint orders_status_check;`
alter table public.orders
  add constraint orders_status_check check (status in ('pending', 'succeeded', 'failed')) not valid;
