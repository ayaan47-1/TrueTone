import { supabaseQuotaStore } from '../supabase-store.ts';
import { hmacSha256Hex } from '../keyed-hash.ts';

const ok = (data: unknown) => jest.fn(async () => ({ data, error: null }));
const reserveArgs = {
  userId: 'u', userKey: 'k', requestId: 'r', reserveMicros: 20000, shortWindowMax: 5,
  userDailyCalls: 20, userDailyMicros: 400000, globalDailyMicros: 25000000,
};

describe('supabaseQuotaStore', () => {
  it('maps attempt rows and passes only hashed keys', async () => {
    const rpc = ok([{ allowed: false, retry_after_s: 42 }]);
    await expect(supabaseQuotaStore(rpc).noteAttempt({ userKey: 'k', ipKey: 'i', userMax: 12, ipMax: 30 }))
      .resolves.toEqual({ ok: false, retryAfterSec: 42 });
    expect(rpc).toHaveBeenCalledWith('chat_note_attempt', { p_user_key: 'k', p_ip_key: 'i', p_user_max: 12, p_ip_max: 30 });
  });

  it('maps reservation statuses', async () => {
    await expect(supabaseQuotaStore(ok([{ status: 'ok', reservation_id: 'x', retry_after_s: 0 }])).reserve(reserveArgs))
      .resolves.toEqual({ ok: true, reservationId: 'x' });
    await expect(supabaseQuotaStore(ok([{ status: 'user_daily', reservation_id: null, retry_after_s: 60 }])).reserve(reserveArgs))
      .resolves.toEqual({ ok: false, reason: 'user_daily', retryAfterSec: 60 });
  });

  it.each([
    ['an RPC error', jest.fn(async () => ({ data: null, error: { message: 'down' } }))],
    ['an unknown status', ok([{ status: 'maybe', reservation_id: null, retry_after_s: 0 }])],
    ['an empty result', ok([])],
    ['ok without an id', ok([{ status: 'ok', reservation_id: null, retry_after_s: 0 }])],
  ])('fails closed (throws) on %s', async (_l, rpc) => {
    await expect(supabaseQuotaStore(rpc).reserve(reserveArgs)).rejects.toThrow('quota-store-unavailable');
  });

  it('settle throws when the event write fails', async () => {
    const rpc = jest.fn(async () => ({ data: null, error: { message: 'x' } }));
    await expect(supabaseQuotaStore(rpc).settle({ reservationId: 'x', actualMicros: 1, breach: false, event: {} as never }))
      .rejects.toThrow('quota-store-unavailable');
  });
});

describe('hmacSha256Hex', () => {
  it('matches the RFC 4231 test case 2 vector', async () => {
    await expect(hmacSha256Hex('what do ya want for nothing?', 'Jefe'))
      .resolves.toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });
});
