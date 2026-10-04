// Security fix (audit 2026-10-04, MEDIUM-1): orders are written only server-side by service_role.
// The client role lost INSERT on public.orders (migration 0025), so create-payment-intent must
// insert the pending order through a service-role client, with status forced to 'pending' and
// the server-computed amount — never anything the caller sent.
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildPendingOrderRow, insertPendingOrder, type OrderInsertDb } from '../pending-order';

const input = {
  userId: 'user-1',
  paymentIntentId: 'pi_123',
  amountCents: 2500,
  items: [{ product: { id: 'p1' }, qty: 1 }],
  shippingAddress: { line1: '1 Main St' },
};

function fakeDb(error: unknown = null) {
  const inserted: { table: string; row: unknown }[] = [];
  const db: OrderInsertDb = {
    from: (table) => ({
      insert: async (row) => {
        inserted.push({ table, row });
        return { error };
      },
    }),
  };
  return { db, inserted };
}

describe('buildPendingOrderRow', () => {
  it('always sets status pending and uses the server-computed amount', () => {
    expect(buildPendingOrderRow(input)).toEqual({
      user_id: 'user-1',
      stripe_payment_intent_id: 'pi_123',
      amount: 2500,
      items: input.items,
      shipping_address: { line1: '1 Main St' },
      status: 'pending',
    });
  });

  it('ignores status/amount smuggled onto the input object', () => {
    const tampered = { ...input, status: 'succeeded', amount: 1 } as typeof input;
    const row = buildPendingOrderRow(tampered);
    expect(row.status).toBe('pending');
    expect(row.amount).toBe(2500);
  });

  it('stores a missing shipping address as null', () => {
    expect(buildPendingOrderRow({ ...input, shippingAddress: undefined }).shipping_address).toBeNull();
  });

  it.each([0, -5, 1.5, NaN])('rejects a non-positive or non-integer amount (%p)', (amountCents) => {
    expect(() => buildPendingOrderRow({ ...input, amountCents })).toThrow('invalid amount');
  });

  it('rejects a missing user id or payment intent id', () => {
    expect(() => buildPendingOrderRow({ ...input, userId: '' })).toThrow();
    expect(() => buildPendingOrderRow({ ...input, paymentIntentId: '' })).toThrow();
  });
});

describe('insertPendingOrder', () => {
  it('inserts the pending row into orders', async () => {
    const { db, inserted } = fakeDb();
    await expect(insertPendingOrder(db, input)).resolves.toEqual({ error: null });
    expect(inserted).toEqual([{ table: 'orders', row: buildPendingOrderRow(input) }]);
  });

  it('passes the database error back to the caller', async () => {
    const { db } = fakeDb({ message: 'boom' });
    await expect(insertPendingOrder(db, input)).resolves.toEqual({ error: { message: 'boom' } });
  });
});

describe('create-payment-intent wiring', () => {
  const src = readFileSync(join(__dirname, '../../../create-payment-intent/index.ts'), 'utf8');

  it('inserts the order through a service-role client, not the caller JWT client', () => {
    expect(src).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(src).toMatch(/insertPendingOrder\(\s*admin\s*,/);
  });

  it('checks the service-role key before any Stripe call, so a misconfig leaves no orphaned PaymentIntent', () => {
    const keyCheck = src.search(/if\s*\(\s*!serviceRoleKey\s*\)/);
    expect(keyCheck).toBeGreaterThan(-1);
    expect(keyCheck).toBeLessThan(src.indexOf('new Stripe('));
  });

  it('never inserts into orders with the JWT-scoped client', () => {
    expect(src).not.toMatch(/supabase\s*\.from\(\s*['"]orders['"]\s*\)/);
  });
});
