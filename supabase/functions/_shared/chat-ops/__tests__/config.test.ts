import { loadChatConfig, PINNED_MODEL_ID } from '../config.ts';
import { parseUsdToMicros, formatMicros } from '../money.ts';
import { VALID_ENV } from '../__fixtures__/env.ts';

const envOf = (over: Record<string, string | undefined> = {}) => {
  const e: Record<string, string | undefined> = { ...VALID_ENV, ...over };
  return (k: string) => e[k];
};

describe('money', () => {
  it('parses USD decimal strings to integer micro-dollars', () => {
    expect(parseUsdToMicros('0.0200')).toBe(20_000);
    expect(parseUsdToMicros('25.00')).toBe(25_000_000);
    expect(parseUsdToMicros('3')).toBe(3_000_000);
  });
  it('rejects malformed or over-precise amounts', () => {
    for (const bad of ['', '-1', '1e3', '0.0000001', 'abc', ' 1', '1.']) {
      expect(parseUsdToMicros(bad)).toBeNull();
    }
  });
  it('formats micro-dollars as a fixed six-decimal string', () => {
    expect(formatMicros(18_000)).toBe('0.018000');
    expect(formatMicros(25_000_000)).toBe('25.000000');
  });
});

describe('loadChatConfig', () => {
  it('returns the enabled config with the contract values', () => {
    const r = loadChatConfig(envOf());
    expect(r.state).toBe('enabled');
    if (r.state !== 'enabled') return;
    expect(r.config.modelId).toBe(PINNED_MODEL_ID);
    expect(r.config.maxOutputTokens).toBe(600);
    expect(r.config.maxInputTokens).toBe(3000);
    expect(r.config.reserveMicros).toBe(20_000);
    expect(r.config.userDailyMicros).toBe(400_000);
    expect(r.config.globalDailyMicros).toBe(25_000_000);
  });

  it('is disabled by default when nothing is configured', () => {
    expect(loadChatConfig(() => undefined)).toEqual({ state: 'disabled', reason: 'manual_off' });
  });

  it('CHAT_ENABLED other than exactly "true" is a manual stop', () => {
    for (const v of ['false', 'TRUE', '1', '']) {
      expect(loadChatConfig(envOf({ CHAT_ENABLED: v }))).toEqual({ state: 'disabled', reason: 'manual_off' });
    }
  });

  it('CHAT_COST_KILLED=true disables even when enabled', () => {
    expect(loadChatConfig(envOf({ CHAT_COST_KILLED: 'true' }))).toEqual({ state: 'disabled', reason: 'cost_killed' });
  });

  it.each(Object.keys(VALID_ENV).filter((k) => k !== 'CHAT_ENABLED' && k !== 'CHAT_COST_KILLED'))(
    'missing %s fails closed as invalid config', (key) => {
      expect(loadChatConfig(envOf({ [key]: undefined }))).toEqual({ state: 'disabled', reason: 'config_invalid' });
    });

  it.each([
    ['CHAT_MODEL_ID', 'claude-sonnet-latest'],
    ['CHAT_MODEL_ID', 'claude-sonnet-5'],
    ['CHAT_MAX_OUTPUT_TOKENS', '601'],
    ['CHAT_MAX_INPUT_TOKENS', '3001'],
    ['CHAT_MAX_INPUT_TOKENS', '12.5'],
    ['CHAT_COST_KILLED', 'maybe'],
    ['CHAT_USER_KEY_SECRET', 'short'],
    ['CHAT_RESERVE_USD', '0.0100'], // below the 3000/600 ceiling cost of $0.018
    ['CHAT_USER_DAILY_CALLS', '0'],
  ])('%s=%s fails closed as invalid config', (key, value) => {
    expect(loadChatConfig(envOf({ [key]: value }))).toEqual({ state: 'disabled', reason: 'config_invalid' });
  });

  it('a throwing env reader fails closed', () => {
    expect(loadChatConfig(() => { throw new Error('boom'); })).toEqual({ state: 'disabled', reason: 'config_invalid' });
  });
});
