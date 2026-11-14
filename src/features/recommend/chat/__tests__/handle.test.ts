import { handleChat } from '../handle';
import type { ChatDeps } from '../handle';

test('medical query short-circuits to referral and NEVER calls the LLM', async () => {
  const complete = jest.fn();
  const deps: ChatDeps = { complete, consumeQuota: async () => true };
  const out = await handleChat(deps, { message: 'is this mole cancer?', history: [] });
  expect(out.referred).toBe(true);
  expect(complete).not.toHaveBeenCalled();
});

test('a clean LLM reply is returned as-is', async () => {
  const deps: ChatDeps = { complete: async () => 'Your SPF step looks great.', consumeQuota: async () => true };
  const out = await handleChat(deps, { message: 'why SPF?', history: [] });
  expect(out.reply).toContain('SPF');
  expect(out.blocked).toBe(false);
});

test('a disease term in the LLM reply is replaced by the fallback', async () => {
  const deps: ChatDeps = { complete: async () => 'You have eczema.', consumeQuota: async () => true };
  const out = await handleChat(deps, { message: 'what is this?', history: [] });
  expect(out.blocked).toBe(true);
  expect(out.reply.toLowerCase()).toContain('dermatologist');
});

test('general chat needs no saved scan', async () => {
  const deps: ChatDeps = { complete: async () => 'A cleanser removes makeup.', consumeQuota: async () => true };
  await expect(handleChat(deps, { message: 'hi', history: [] })).resolves.toEqual({
    reply: 'A cleanser removes makeup.', blocked: false, referred: false,
  });
});

// MASVS M3: the medical refusal covers every user turn, and the LLM call is quota-limited per user.
test('a medical question hidden in an earlier user turn is refused without calling the LLM', async () => {
  const complete = jest.fn();
  const deps: ChatDeps = { complete, consumeQuota: async () => true };
  const out = await handleChat(deps, {
    message: 'so what do you think?',
    history: [{ role: 'user', content: 'is this mole cancer?' }, { role: 'assistant', content: 'Sure.' }],
  });
  expect(out.referred).toBe(true);
  expect(complete).not.toHaveBeenCalled();
});

test('an exhausted per-user quota throws rate-limited and never calls the LLM', async () => {
  const complete = jest.fn();
  const deps: ChatDeps = { complete, consumeQuota: async () => false };
  await expect(handleChat(deps, { message: 'why SPF?', history: [] })).rejects.toThrow('rate-limited');
  expect(complete).not.toHaveBeenCalled();
});

test('a referral does not consume quota', async () => {
  const consumeQuota = jest.fn(async () => true);
  const deps: ChatDeps = { complete: jest.fn(), consumeQuota };
  await handleChat(deps, { message: 'is this melanoma?', history: [] });
  expect(consumeQuota).not.toHaveBeenCalled();
});
