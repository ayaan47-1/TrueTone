import { handleGuardedChat, type GuardedChatDeps, type ProviderResult } from '../handler.ts';
import { loadChatConfig } from '../config.ts';
import { MemoryQuotaStore } from '../__fixtures__/memory-store.ts';
import { VALID_ENV } from '../__fixtures__/env.ts';
import { REFERRAL_MESSAGE } from '../../recommend/refusal.ts';
import { FALLBACK_MESSAGE } from '../../recommend/guard.ts';
import type { QuotaStore } from '../quota-store.ts';

const SCAN = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AUTH = 'Bearer secret.jwt.token';
const IP = '203.0.113.7';
const MESSAGE = 'what order should my serum go in';
const HISTORY_TEXT = 'previous question about moisturizer';
const REPLY = 'Apply the serum after cleansing, then moisturizer.';
const T0 = Date.UTC(2026, 8, 24, 12, 0, 0);

const scan = {
  scores: { hydration: 0.5, oiliness: 0.5, texture: 0.5, pores: 0.5, darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5 },
  skinType: 'combination' as const,
  routine: { version: 'skincare-1', am: [], pm: [], notes: [] } as never,
};

function setup(over: Partial<GuardedChatDeps> = {}, env: Record<string, string | undefined> = {}) {
  let now = T0;
  let n = 0;
  const store = new MemoryQuotaStore(() => now);
  const logs: unknown[] = [];
  const provider = jest.fn(async (): Promise<ProviderResult> => ({
    text: REPLY, usage: { input_tokens: 1000, output_tokens: 250, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  }));
  const e = { ...VALID_ENV, ...env };
  const deps: GuardedChatDeps = {
    config: () => loadChatConfig((k) => e[k]),
    verifyUser: jest.fn(async (h: string) => (h === AUTH ? USER_ID : null)),
    keyedHash: async (v) => `k${hash(v)}`,
    store,
    loadScan: jest.fn(async (id: string) => (id === SCAN ? scan : null)),
    callProvider: provider,
    nowMs: () => now,
    newId: () => `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`,
    log: (x) => logs.push(x),
    ...over,
  };
  return { deps, store, provider, logs, advance: (ms: number) => { now += ms; } };
}
// Deterministic stand-in for the HMAC: a short digest that never contains the input text.
function hash(v: string): string {
  let h = 7;
  for (const c of v) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(16);
}
const req = (body: unknown = { scanId: SCAN, message: MESSAGE, history: [{ role: 'user', content: HISTORY_TEXT }] }, authHeader: string | null = AUTH) =>
  ({ authHeader, clientIp: IP, body });

describe('model pin and metering', () => {
  it('calls the pinned model once with max_tokens 600 and records one numeric event', async () => {
    const { deps, provider, store } = setup();
    const res = await handleGuardedChat(deps, req());
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ reply: REPLY, referred: false, blocked: false });
    expect(provider).toHaveBeenCalledTimes(1);
    const arg = (provider.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(arg.model).toBe('claude-sonnet-4-6');
    expect(arg.max_tokens).toBe(600);
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      model_id: 'claude-sonnet-4-6', model_pricing_revision: 'anthropic-sonnet-4-6-2026-09-24',
      config_revision: 'cfg-1', function_revision: 'fn-1', environment: 'test',
      input_tokens: 1000, output_tokens: 250, usage_status: 'ok',
      estimated_cost_usd: '0.006750', reserved_cost_usd: '0.020000', reservation_released_usd: '0.013250',
      outcome: 'success', http_status: 200, guard_reason: null, provider_request_attempted: true,
    });
  });

  it('at the 3,000/600 ceiling reserves $0.0200 and releases $0.0020', async () => {
    const { deps, store } = setup({ callProvider: async () => ({ text: REPLY, usage: { input_tokens: 3000, output_tokens: 600 } }) });
    await handleGuardedChat(deps, req());
    expect(store.events[0]).toMatchObject({ estimated_cost_usd: '0.018000', reservation_released_usd: '0.002000' });
    expect(store.costKilled).toBe(false);
  });

  it('provider usage beyond the enforced caps is a breach: no reply, cost kill set', async () => {
    const { deps, store } = setup({ callProvider: async () => ({ text: REPLY, usage: { input_tokens: 3000, output_tokens: 700 } }) });
    const res = await handleGuardedChat(deps, req());
    expect(res.status).toBe(503);
    expect(res.json).toBeUndefined();
    expect(store.events[0]).toMatchObject({ outcome: 'cost_cap_breach' });
    expect(store.costKilled).toBe(true);
  });

  it('nonzero cache usage is a breach (prompt caching is disabled)', async () => {
    const { deps, store } = setup({ callProvider: async () => ({ text: REPLY, usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 5 } }) });
    expect((await handleGuardedChat(deps, req())).status).toBe(503);
    expect(store.costKilled).toBe(true);
  });

  it('a provider error makes exactly one attempt, keeps the full reservation, returns generic 503', async () => {
    const provider = jest.fn(async () => { throw new Error('upstream said: ' + MESSAGE); });
    const { deps, store } = setup({ callProvider: provider });
    const res = await handleGuardedChat(deps, req());
    expect(res.status).toBe(503);
    expect(res.text).toBe('chat unavailable');
    expect(provider).toHaveBeenCalledTimes(1);
    expect(store.events[0]).toMatchObject({
      outcome: 'provider_error', usage_status: 'usage_unavailable', input_tokens: null,
      estimated_cost_usd: '0.020000', reservation_released_usd: '0.000000',
    });
  });

  it('an unsafe reply returns the fallback and records only output_blocked', async () => {
    const { deps, store } = setup({ callProvider: async () => ({ text: 'That looks like rosacea.', usage: { input_tokens: 10, output_tokens: 10 } }) });
    const res = await handleGuardedChat(deps, req());
    expect(res.json).toEqual({ reply: FALLBACK_MESSAGE, referred: false, blocked: true });
    expect(store.events[0]).toMatchObject({ outcome: 'output_blocked', guard_reason: 'output_blocked' });
  });

  it('a usage-event write failure withholds the reply (generic 503)', async () => {
    const { deps, store } = setup();
    jest.spyOn(store, 'settle').mockRejectedValue(new Error('db down'));
    const res = await handleGuardedChat(deps, req());
    expect(res.status).toBe(503);
    expect(res.json).toBeUndefined();
  });
});

describe('kill switches and fail-closed dependencies (zero provider calls)', () => {
  it.each([
    ['CHAT_ENABLED=false', { CHAT_ENABLED: 'false' }],
    ['CHAT_COST_KILLED=true', { CHAT_COST_KILLED: 'true' }],
    ['missing configuration', { CHAT_RESERVE_USD: undefined }],
    ['missing pricing revision', { CHAT_PRICING_REVISION: undefined }],
  ])('%s returns generic 503 and logs kill_switch', async (_l, env) => {
    const { deps, provider, logs } = setup({}, env);
    const res = await handleGuardedChat(deps, req());
    expect(res).toEqual({ status: 503, text: 'chat unavailable' });
    expect(provider).not.toHaveBeenCalled();
    expect(deps.verifyUser).not.toHaveBeenCalled();
    expect(logs).toEqual([expect.objectContaining({ outcome: 'kill_switch', http_status: 503, provider_request_attempted: false })]);
  });

  it('a throwing config reader fails closed', async () => {
    const { deps, provider } = setup({ config: () => { throw new Error('x'); } });
    expect((await handleGuardedChat(deps, req())).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(['noteAttempt', 'reserve'] as const)('quota store failure in %s returns 503', async (method) => {
    const { deps, provider, store } = setup();
    jest.spyOn(store, method).mockRejectedValue(new Error('store unavailable'));
    expect((await handleGuardedChat(deps, req())).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });

  it('the database cost-kill state returns 503', async () => {
    const { deps, provider, store } = setup();
    store.costKilled = true;
    expect((await handleGuardedChat(deps, req())).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });
});

describe('identity', () => {
  it('a missing Authorization header is 401 before any store or provider access', async () => {
    const { deps, provider, store } = setup();
    const spy = jest.spyOn(store, 'noteAttempt');
    expect((await handleGuardedChat(deps, req(undefined, null))).status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });
  it('an invalid JWT is 401', async () => {
    const { deps, provider } = setup();
    expect((await handleGuardedChat(deps, req(undefined, 'Bearer forged'))).status).toBe(401);
    expect(provider).not.toHaveBeenCalled();
  });
  it('an auth-service failure is 503', async () => {
    const { deps, provider } = setup({ verifyUser: async () => { throw new Error('x'); } });
    expect((await handleGuardedChat(deps, req())).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });
  it("another user's scan id (RLS returns no row) is 404 with no provider call", async () => {
    const { deps, provider } = setup();
    const res = await handleGuardedChat(deps, req({ scanId: '22222222-2222-2222-2222-222222222222', message: MESSAGE }));
    expect(res.status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
  });
});

describe('input bounds', () => {
  it('a malformed body is 400', async () => {
    const { deps, provider } = setup();
    expect((await handleGuardedChat(deps, req({ scanId: SCAN, message: 'hi', history: [{ role: 'system', content: 'x' }] }))).status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it('twenty long history turns exceed the aggregate cap: 413 before reservation or provider', async () => {
    const { deps, provider, store } = setup();
    const reserve = jest.spyOn(store, 'reserve');
    const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(2000) }));
    const res = await handleGuardedChat(deps, req({ scanId: SCAN, message: MESSAGE, history }));
    expect(res.status).toBe(413);
    expect(reserve).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });
});

describe('medical refusal', () => {
  it('returns the referral with no reservation or provider call, but counts as an attempt', async () => {
    const { deps, provider, store } = setup();
    const res = await handleGuardedChat(deps, req({ scanId: SCAN, message: 'is this mole melanoma?' }));
    expect(res.json).toEqual({ reply: REFERRAL_MESSAGE, referred: true, blocked: false });
    expect(provider).not.toHaveBeenCalled();
    expect(store.reservations).toHaveLength(0);
    expect(store.attempts).toHaveLength(1);
  });
});

describe('rate limits, concurrency and budgets (429 + Retry-After, zero provider calls)', () => {
  const expect429 = (res: { status: number; headers?: Record<string, string> }) => {
    expect(res.status).toBe(429);
    expect(Number(res.headers?.['Retry-After'])).toBeGreaterThan(0);
  };

  it('5 provider-eligible requests per rolling 10 minutes', async () => {
    const { deps, provider, advance } = setup();
    for (let i = 0; i < 5; i++) { expect((await handleGuardedChat(deps, req())).status).toBe(200); advance(1000); }
    expect429(await handleGuardedChat(deps, req()));
    expect(provider).toHaveBeenCalledTimes(5);
    advance(10 * 60 * 1000);
    expect((await handleGuardedChat(deps, req())).status).toBe(200);
  });

  it('12 attempts per user per rolling 10 minutes, referrals included', async () => {
    const { deps, provider } = setup();
    for (let i = 0; i < 12; i++) await handleGuardedChat(deps, req({ scanId: SCAN, message: 'is this mole cancer?' }));
    expect429(await handleGuardedChat(deps, req()));
    expect(provider).not.toHaveBeenCalled();
  });

  it('30 attempts per hashed IP across users', async () => {
    const { deps, provider } = setup({ verifyUser: async (h: string) => h.slice(7) });
    for (let i = 0; i < 30; i++) await handleGuardedChat(deps, req({ scanId: SCAN, message: 'is this mole cancer?' }, `Bearer user-${i}`));
    expect429(await handleGuardedChat(deps, req(undefined, 'Bearer user-new')));
    expect(provider).not.toHaveBeenCalled();
  });

  it('one in-flight provider call per user', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const provider = jest.fn(async () => { await gate; return { text: REPLY, usage: { input_tokens: 10, output_tokens: 10 } }; });
    const { deps } = setup({ callProvider: provider });
    const first = handleGuardedChat(deps, req());
    await new Promise((r) => setImmediate(r));
    expect429(await handleGuardedChat(deps, req()));
    release();
    expect((await first).status).toBe(200);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('20 calls per user per UTC day, reset at 00:00 UTC', async () => {
    const { deps, provider, advance } = setup({}, { CHAT_SHORT_WINDOW_MAX: '100', CHAT_ATTEMPT_WINDOW_MAX: '100', CHAT_IP_WINDOW_MAX: '100', CHAT_USER_DAILY_USD: '10.00' });
    for (let i = 0; i < 20; i++) expect((await handleGuardedChat(deps, req())).status).toBe(200);
    const res = await handleGuardedChat(deps, req());
    expect429(res);
    expect(Number(res.headers?.['Retry-After'])).toBe(12 * 3600); // T0 is 12:00 UTC
    expect(provider).toHaveBeenCalledTimes(20);
    advance(12 * 3600 * 1000);
    expect((await handleGuardedChat(deps, req())).status).toBe(200);
  });

  it('$0.40 reserved cost per user per UTC day', async () => {
    const { deps, provider } = setup({ callProvider: async () => ({ text: REPLY, usage: { input_tokens: 3000, output_tokens: 600 } }) },
      { CHAT_SHORT_WINDOW_MAX: '100', CHAT_ATTEMPT_WINDOW_MAX: '100', CHAT_IP_WINDOW_MAX: '100', CHAT_USER_DAILY_CALLS: '100', CHAT_RESERVE_USD: '0.1000' });
    for (let i = 0; i < 4; i++) expect((await handleGuardedChat(deps, req())).status).toBe(200); // 4 × $0.018 actual
    for (let i = 0; i < 13; i++) await handleGuardedChat(deps, req()); // $0.072 + 13×$0.018 = $0.306
    expect429(await handleGuardedChat(deps, req())); // $0.306 + $0.10 reserve > $0.40
  });

  it('$25.00 global reserved cost: the next reservation is denied and the cost kill persists across the UTC reset', async () => {
    const { deps, provider, store, advance } = setup();
    store.reservations.push({ id: 'seed', userKey: 'other', reserved: 24_980_000, actual: 24_980_000, state: 'settled', at: T0 - 1000 });
    expect((await handleGuardedChat(deps, req())).status).toBe(200); // lands exactly on $25.00
    advance(1000);
    expect((await handleGuardedChat(deps, req())).status).toBe(503);
    expect(store.costKilled).toBe(true);
    expect(provider).toHaveBeenCalledTimes(1);
    advance(24 * 3600 * 1000);
    expect((await handleGuardedChat(deps, req())).status).toBe(503);
  });
});

describe('redaction', () => {
  it('no event, log line, or store argument carries text, raw identifiers, JWT, IP, or secrets', async () => {
    const { deps, store, logs } = setup();
    const noteSpy = jest.spyOn(store, 'noteAttempt');
    const reserveSpy = jest.spyOn(store, 'reserve');
    await handleGuardedChat(deps, req());
    await handleGuardedChat(deps, req({ scanId: SCAN, message: 'is this mole cancer?' }));
    const settleArgsOnly = store.events;
    const blob = JSON.stringify([settleArgsOnly, logs, noteSpy.mock.calls, reserveSpy.mock.calls.map(([a]) => ({ ...a, userId: undefined }))]);
    for (const forbidden of [MESSAGE, HISTORY_TEXT, REPLY, 'mole', USER_ID, AUTH, 'secret.jwt', IP, VALID_ENV.CHAT_USER_KEY_SECRET, 'skincare assistant', SCAN]) {
      expect(blob).not.toContain(forbidden);
    }
    const allowed = new Set(['event_id', 'request_id', 'occurred_at', 'environment', 'function_revision', 'config_revision', 'user_key',
      'model_id', 'model_pricing_revision', 'input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens',
      'usage_status', 'estimated_cost_usd', 'reserved_cost_usd', 'reservation_released_usd', 'outcome', 'http_status', 'latency_ms',
      'guard_reason', 'provider_request_attempted']);
    for (const ev of store.events) expect(Object.keys(ev).every((k) => allowed.has(k))).toBe(true);
  });
});
