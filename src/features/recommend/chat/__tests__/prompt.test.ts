import { buildChatPrompt } from '../prompt';

test('system prompt forbids diagnosis and denies access to saved personal context', () => {
  const { system } = buildChatPrompt({ history: [], message: 'hi' });
  expect(system.toLowerCase()).toContain('dermatologist');
  expect(system.toLowerCase()).toContain('do not diagnose');
  expect(system).toContain('You have no access to any scan');
  expect(system).toContain('Do not infer skincare needs from a photo or shade');
});

test('system instructions are constant across conversations, with no personalized template', () => {
  const one = buildChatPrompt({ history: [], message: 'hi' });
  const two = buildChatPrompt({ history: [{ role: 'user', content: 'I prefer fragrance-free products' }], message: 'cleanser?' });
  expect(one.system).toBe(two.system);
  expect(two.system).not.toContain('fragrance-free');
  expect(two.system).not.toContain("This user's skin reads");
});

test('history and the new message are appended in order', () => {
  const { messages } = buildChatPrompt({
    history: [{ role: 'user', content: 'earlier' }, { role: 'assistant', content: 'reply' }],
    message: 'why SPF?',
  });
  expect(messages.map((m) => m.content)).toEqual(['earlier', 'reply', 'why SPF?']);
});
