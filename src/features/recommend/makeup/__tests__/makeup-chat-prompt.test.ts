import { buildMakeupChatPrompt } from '../makeup-chat-prompt';
import type { CurrentShade } from '../../../session/personalization';
import type { SetupAnswers } from '../../../preferences/preferences-types';

// A derived shade whose numeric depth (7) must NEVER surface in the prompt (CLAUDE.md §3).
const shade: CurrentShade = { shadeName: 'Medium Warm', undertone: 'warm', depth: 7, finish: 'natural' };
const preferences: SetupAnswers = {
  goals: ['even_base', 'natural_glow'],
  coverage: 'everyday',
  skips: ['drying_matte'],
};

test('system prompt scopes to makeup/shade, forbids diagnosis, and refers medical concerns out', () => {
  const { system } = buildMakeupChatPrompt({ shade, preferences, history: [], message: 'hi' });
  const lower = system.toLowerCase();
  expect(lower).toContain('makeup');
  expect(lower).toContain('do not diagnose');
  expect(lower).toContain('dermatologist');
});

test('system prompt instructs the model NOT to rank or recommend specific products', () => {
  const { system } = buildMakeupChatPrompt({ shade, preferences, history: [], message: 'hi' });
  const lower = system.toLowerCase();
  // The deterministic shade-match shelf owns ranking; the LLM must not.
  expect(lower).toContain('do not rank');
  expect(lower).toContain('shade-match');
});

test('context carries the shade WORDS and preferences, never the numeric depth', () => {
  const { system } = buildMakeupChatPrompt({ shade, preferences, history: [], message: 'hi' });
  expect(system).toContain('Medium Warm');
  expect(system).toContain('Warm'); // undertone label
  expect(system).toContain('Natural'); // finish label
  expect(system).toContain('Everyday'); // coverage label
  expect(system).toContain('Even base'); // goal label
  // The raw shade depth (a number) is never surfaced.
  expect(system).not.toContain('7');
});

test('empty goals and skips render a safe placeholder, not undefined', () => {
  const bare: SetupAnswers = { goals: [], coverage: 'light', skips: [] };
  const { system } = buildMakeupChatPrompt({ shade, preferences: bare, history: [], message: 'hi' });
  expect(system).not.toContain('undefined');
});

test('history and the new message are appended in order', () => {
  const { messages } = buildMakeupChatPrompt({
    shade,
    preferences,
    history: [
      { role: 'user', content: 'earlier' },
      { role: 'assistant', content: 'reply' },
    ],
    message: 'what undertone suits me?',
  });
  expect(messages.map((m) => m.content)).toEqual(['earlier', 'reply', 'what undertone suits me?']);
});
