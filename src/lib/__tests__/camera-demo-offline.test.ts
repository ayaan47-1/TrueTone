// Dwight FAIL on PR #60: the camera TestFlight build must never reach a live backend, even if a
// production URL/key leaks into its environment. These tests feed production-looking values and
// prove that under EXPO_PUBLIC_CAMERA_DEMO=1 nothing calls the network.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const PROD_LIKE_ENV = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://prodlike-project.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.prodlike.signature',
};

const STUB_RESULT = {
  scores: { hydration: 0.5, oiliness: 0.4, redness: 0.2, texture: 0.3, tone_evenness: 0.6 },
  skinType: 'combination',
  modelVersion: 'cv-1',
  isStub: false,
  captureQuality: 'good',
} as never;

type Supa = typeof import('../supabase');
type Scans = typeof import('../scans');
type Chat = typeof import('../routine-chat');

const originalEnv = process.env;
const originalFetch = global.fetch;
let fetchSpy: jest.Mock;

function load(env: Record<string, string>): { supa: Supa; scans: Scans; chat: Chat } {
  process.env = { ...originalEnv, ...PROD_LIKE_ENV, ...env };
  let out!: { supa: Supa; scans: Scans; chat: Chat };
  jest.isolateModules(() => {
    out = {
      supa: require('../supabase'),
      scans: require('../scans'),
      chat: require('../routine-chat'),
    };
  });
  return out;
}

beforeEach(() => {
  fetchSpy = jest.fn().mockRejectedValue(new Error('network-used'));
  global.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
});

describe('control: a normal build with the same env does use the network', () => {
  test('rpc reaches fetch', async () => {
    const { supa } = load({ EXPO_PUBLIC_CAMERA_DEMO: '' });
    await supa.supabase.rpc('ensure_profile');
    expect(fetchSpy).toHaveBeenCalled();
  });
});

describe('camera demo with production-looking env', () => {
  const CAM = { EXPO_PUBLIC_CAMERA_DEMO: '1' };

  test('client is local-only: never the production URL, no persisted or refreshing session', () => {
    const { supa } = load(CAM);
    expect(supa.SUPABASE_OFFLINE).toBe(true);
    expect(supa.SUPABASE_TARGET_URL).not.toContain('supabase.co');
    expect(supa.SUPABASE_AUTH_OPTIONS.persistSession).toBe(false);
    expect(supa.SUPABASE_AUTH_OPTIONS.autoRefreshToken).toBe(false);
  });

  test('rpc, table reads, edge functions and auth all fail closed with zero fetch calls', async () => {
    const { supa } = load(CAM);
    const rpc = await supa.supabase.rpc('record_scan', {});
    const read = await supa.supabase.from('scans').select('*');
    const fn = await supa.supabase.functions.invoke('create-payment-intent', { body: {} });
    const anon = await supa.supabase.auth.signInAnonymously();
    await supa.supabase.auth.getSession();
    expect(rpc.error).toBeTruthy();
    expect(read.error).toBeTruthy();
    expect(fn.error).toBeTruthy();
    expect(anon.error).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    // postgrest-js retries failed GETs with backoff (not configurable through createClient); the
    // retries hit the same offline fetch, so the read still fails closed, just after a few seconds.
  }, 30000);

  test('recordScan keeps derived scores on device and the history reads them back, no network', async () => {
    const { supa, scans } = load(CAM);
    const rpcSpy = jest.spyOn(supa.supabase, 'rpc');
    const fromSpy = jest.spyOn(supa.supabase, 'from');
    await scans.recordScan(STUB_RESULT, null, 'good');
    const latest = await scans.fetchLatestScan();
    const history = await scans.fetchScanHistory(10);
    expect(latest?.skinType).toBe('combination');
    expect(history).toHaveLength(1);
    await scans.setRoutineFeedback(history[0].id, 'helped');
    expect((await scans.fetchLatestScan())?.routineHelpful).toBe('helped');
    expect(rpcSpy).not.toHaveBeenCalled();
    expect(fromSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('clearing local scans empties the history', async () => {
    const { scans } = load(CAM);
    await scans.recordScan(STUB_RESULT);
    scans.clearCameraDemoScans();
    expect(await scans.fetchScanHistory()).toEqual([]);
  });

  test('chat fails closed without invoking the edge function', async () => {
    const { supa, chat } = load(CAM);
    const invokeSpy = jest.spyOn(supa.supabase.functions, 'invoke');
    await expect(chat.sendChat('scan-1', 'hi', [])).rejects.toThrow('chat-offline');
    expect(invokeSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
