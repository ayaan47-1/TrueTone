import { handleMakeupChat } from '../makeup-chat-handle';
import type { MakeupChatDeps } from '../makeup-chat-handle';
import type { CurrentShade } from '../../../session/personalization';
import type { SetupAnswers } from '../../../preferences/preferences-types';

const shade: CurrentShade = { shadeName: 'Deep Neutral', undertone: 'neutral', depth: 9, finish: 'satin' };
const preferences: SetupAnswers = { goals: ['all_day_wear'], coverage: 'glam', skips: [] };
const ctx = { shade, preferences };

test('medical query short-circuits to referral and NEVER calls the LLM', async () => {
  const complete = jest.fn();
  const deps: MakeupChatDeps = { loadContext: async () => ctx, complete };
  const out = await handleMakeupChat(deps, { message: 'is this mole cancer?', history: [] });
  expect(out.referred).toBe(true);
  expect(complete).not.toHaveBeenCalled();
});

test('a clean LLM reply is returned as-is', async () => {
  const deps: MakeupChatDeps = {
    loadContext: async () => ctx,
    complete: async () => 'A satin finish suits your neutral undertone.',
  };
  const out = await handleMakeupChat(deps, { message: 'what finish works?', history: [] });
  expect(out.reply).toContain('satin');
  expect(out.blocked).toBe(false);
  expect(out.referred).toBe(false);
});

test('a disease term in the LLM reply is replaced by the fallback (fail-closed)', async () => {
  const deps: MakeupChatDeps = {
    loadContext: async () => ctx,
    complete: async () => 'This will clear up your acne.',
  };
  const out = await handleMakeupChat(deps, { message: 'will it help?', history: [] });
  expect(out.blocked).toBe(true);
  expect(out.reply.toLowerCase()).toContain('dermatologist');
});

test('missing shade context throws shade-not-found', async () => {
  const deps: MakeupChatDeps = { loadContext: async () => null, complete: async () => 'x' };
  await expect(handleMakeupChat(deps, { message: 'hi', history: [] })).rejects.toThrow('shade-not-found');
});

test('the shade context is passed into the prompt the LLM receives', async () => {
  let seenSystem = '';
  const deps: MakeupChatDeps = {
    loadContext: async () => ctx,
    complete: async (system) => {
      seenSystem = system;
      return 'ok';
    },
  };
  await handleMakeupChat(deps, { message: 'hi', history: [] });
  expect(seenSystem).toContain('Deep Neutral');
  expect(seenSystem).not.toContain('9'); // numeric depth never crosses to the model
});
