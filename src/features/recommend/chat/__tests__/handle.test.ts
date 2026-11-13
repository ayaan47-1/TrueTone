import { handleChat } from '../handle';
import type { ChatDeps } from '../handle';
import type { Routine } from '../../routine-types';

const routine: Routine = { version: 'skincare-1', am: [], pm: [], notes: [] };
const ctx = {
  scores: { hydration: 0.5, oiliness: 0.5, texture: 0.5, pores: 0.5, darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5 },
  skinType: 'combination' as const, routine,
};

test('medical query short-circuits to referral and NEVER calls the LLM', async () => {
  const complete = jest.fn();
  const deps: ChatDeps = { loadScan: async () => ctx, complete, consumeQuota: async () => true };
  const out = await handleChat(deps, { scanId: 's1', message: 'is this mole cancer?', history: [] });
  expect(out.referred).toBe(true);
  expect(complete).not.toHaveBeenCalled();
});

test('a clean LLM reply is returned as-is', async () => {
  const deps: ChatDeps = { loadScan: async () => ctx, complete: async () => 'Your SPF step looks great.', consumeQuota: async () => true };
  const out = await handleChat(deps, { scanId: 's1', message: 'why SPF?', history: [] });
  expect(out.reply).toContain('SPF');
  expect(out.blocked).toBe(false);
});

test('a disease term in the LLM reply is replaced by the fallback', async () => {
  const deps: ChatDeps = { loadScan: async () => ctx, complete: async () => 'You have eczema.', consumeQuota: async () => true };
  const out = await handleChat(deps, { scanId: 's1', message: 'what is this?', history: [] });
  expect(out.blocked).toBe(true);
  expect(out.reply.toLowerCase()).toContain('dermatologist');
});

test('missing scan throws scan-not-found', async () => {
  const deps: ChatDeps = { loadScan: async () => null, complete: async () => 'x', consumeQuota: async () => true };
  await expect(handleChat(deps, { scanId: 'nope', message: 'hi', history: [] })).rejects.toThrow('scan-not-found');
});

// MASVS M3: the medical refusal covers every user turn, and the LLM call is quota-limited per user.
test('a medical question hidden in an earlier user turn is refused without calling the LLM', async () => {
  const complete = jest.fn();
  const deps: ChatDeps = { loadScan: async () => ctx, complete, consumeQuota: async () => true };
  const out = await handleChat(deps, {
    scanId: 's1',
    message: 'so what do you think?',
    history: [{ role: 'user', content: 'is this mole cancer?' }, { role: 'assistant', content: 'Sure.' }],
  });
  expect(out.referred).toBe(true);
  expect(complete).not.toHaveBeenCalled();
});

test('an exhausted per-user quota throws rate-limited and never calls the LLM', async () => {
  const complete = jest.fn();
  const deps: ChatDeps = { loadScan: async () => ctx, complete, consumeQuota: async () => false };
  await expect(handleChat(deps, { scanId: 's1', message: 'why SPF?', history: [] })).rejects.toThrow('rate-limited');
  expect(complete).not.toHaveBeenCalled();
});

test('a referral does not consume quota', async () => {
  const consumeQuota = jest.fn(async () => true);
  const deps: ChatDeps = { loadScan: async () => ctx, complete: jest.fn(), consumeQuota };
  await handleChat(deps, { scanId: 's1', message: 'is this melanoma?', history: [] });
  expect(consumeQuota).not.toHaveBeenCalled();
});
