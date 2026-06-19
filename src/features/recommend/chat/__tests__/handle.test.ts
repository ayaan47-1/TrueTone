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
  const deps: ChatDeps = { loadScan: async () => ctx, complete };
  const out = await handleChat(deps, { scanId: 's1', message: 'is this mole cancer?', history: [] });
  expect(out.referred).toBe(true);
  expect(complete).not.toHaveBeenCalled();
});

test('a clean LLM reply is returned as-is', async () => {
  const deps: ChatDeps = { loadScan: async () => ctx, complete: async () => 'Your SPF step looks great.' };
  const out = await handleChat(deps, { scanId: 's1', message: 'why SPF?', history: [] });
  expect(out.reply).toContain('SPF');
  expect(out.blocked).toBe(false);
});

test('a disease term in the LLM reply is replaced by the fallback', async () => {
  const deps: ChatDeps = { loadScan: async () => ctx, complete: async () => 'You have eczema.' };
  const out = await handleChat(deps, { scanId: 's1', message: 'what is this?', history: [] });
  expect(out.blocked).toBe(true);
  expect(out.reply.toLowerCase()).toContain('dermatologist');
});

test('missing scan throws scan-not-found', async () => {
  const deps: ChatDeps = { loadScan: async () => null, complete: async () => 'x' };
  await expect(handleChat(deps, { scanId: 'nope', message: 'hi', history: [] })).rejects.toThrow('scan-not-found');
});
