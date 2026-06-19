import { buildChatPrompt, scoreToBand } from '../prompt';
import type { Routine } from '../../routine-types';
import type { ScoreVector } from '../../../read/read-types';

const scores: ScoreVector = {
  hydration: 0.1, oiliness: 0.5, texture: 0.5, pores: 0.5,
  darkSpots: 0.5, redness: 0.5, fineLines: 0.5, darkCircles: 0.5,
};
const routine: Routine = {
  version: 'skincare-1',
  am: [{ category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'apply every morning', rationale: 'daily habit', dimensions: [] }],
  pm: [], notes: ['note'],
};

test('low hydration maps to the lowest band label', () => {
  expect(scoreToBand('hydration', 0.1)).toBe('Looks dehydrated');
});

test('system prompt forbids diagnosis and scopes to the read + routine', () => {
  const { system } = buildChatPrompt({ scores, skinType: 'dry', routine, history: [], message: 'hi' });
  expect(system.toLowerCase()).toContain('dermatologist');
  expect(system.toLowerCase()).toContain('do not diagnose');
});

test('context carries band labels and the routine, never raw numeric scores', () => {
  const { system } = buildChatPrompt({ scores, skinType: 'dry', routine, history: [], message: 'hi' });
  expect(system).toContain('Looks dehydrated');
  expect(system).toContain('a broad-spectrum SPF 30+ sunscreen');
  expect(system).not.toContain('0.1'); // raw scores are never surfaced
});

test('history and the new message are appended in order', () => {
  const { messages } = buildChatPrompt({
    scores, skinType: 'dry', routine,
    history: [{ role: 'user', content: 'earlier' }, { role: 'assistant', content: 'reply' }],
    message: 'why SPF?',
  });
  expect(messages.map((m) => m.content)).toEqual(['earlier', 'reply', 'why SPF?']);
});
