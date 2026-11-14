import { parseChatRequest } from '../validate';
import { handleChat } from '../handle';
import type { ChatTurn } from '../prompt';

const legacy = {
  scanId: 'scan-private-canary',
  message: 'What does a cleanser do?',
  history: [{ role: 'user' as const, content: 'Hello' }],
  scores: { hydration: 0.12, oiliness: 0.92 },
  skinType: 'dry',
  routine: { am: [{ category: 'private-routine-canary', habit: 'daily' }], pm: [] },
};

test('the accepted request carries only user-written text, not a scan identifier or structured context', () => {
  expect(parseChatRequest(legacy)).toEqual({ ok: true, value: {
    message: 'What does a cleanser do?', history: [{ role: 'user', content: 'Hello' }],
  } });
});

test('chat never loads a scan or sends inferred skin context or a stored routine to the provider', async () => {
  const loadScan = jest.fn(async () => ({
    scores: { hydration: 0.12, oiliness: 0.92, texture: 0.5, pores: 0.5, darkSpots: 0.5,
      redness: 0.5, fineLines: 0.5, darkCircles: 0.5 },
    skinType: 'dry' as const,
    routine: { version: 'skincare-1' as const, am: [], pm: [], notes: ['private-routine-canary'] },
  }));
  const complete = jest.fn(async (_system: string, _messages: ChatTurn[]) => 'A cleanser removes makeup.');
  const deps = { loadScan, complete, consumeQuota: async () => true };
  const result = await handleChat(deps, legacy);
  expect(result.reply).toBe('A cleanser removes makeup.');
  expect(loadScan).not.toHaveBeenCalled();
  expect(complete).toHaveBeenCalledTimes(1);
  const [system, messages] = complete.mock.calls[0];
  expect(messages).toEqual([{ role: 'user', content: 'Hello' }, { role: 'user', content: 'What does a cleanser do?' }]);
  expect(system).not.toMatch(/skin reads|skin type feel|Looks dehydrated|private-routine-canary|0\.12|0\.92/);
});
