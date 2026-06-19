// SOURCE OF TRUTH: src/features/recommend/chat/prompt.ts — this copy is kept in sync manually.
import { BAND_LABELS, SKIN_TYPE_LABELS, DIMENSIONS } from './cosmetic-vocab.ts';
import type { Dimension } from './cosmetic-vocab.ts';
import type { ScoreVector, SkinTypeFeel } from './read-types.ts';
import type { Routine } from './routine-types.ts';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }
export interface PromptInput {
  scores: ScoreVector; skinType: SkinTypeFeel; routine: Routine; history: ChatTurn[]; message: string;
}

export function scoreToBand(dim: Dimension, value: number): string {
  const [low, mid, high] = BAND_LABELS[dim];
  if (value <= 0.4) return low;
  if (value >= 0.6) return high;
  return mid;
}

function renderRoutine(routine: Routine): string {
  const line = (s: { category: string; habit: string }) => `- ${s.category} (${s.habit})`;
  return [
    'AM:', ...routine.am.map(line),
    'PM:', ...routine.pm.map(line),
  ].join('\n');
}

export function buildChatPrompt(input: PromptInput): { system: string; messages: ChatTurn[] } {
  const bandLines = DIMENSIONS.map((d) => `- ${d}: ${scoreToBand(d, input.scores[d])}`).join('\n');
  const system = [
    'You are TrueTone\'s cosmetic skincare assistant. You describe how skin LOOKS and explain a ' +
      'brand-neutral cosmetic routine. You are NOT a medical professional.',
    'Rules you MUST follow:',
    '- Describe appearance only, using everyday cosmetic language.',
    '- Only answer about THIS user\'s read and routine below. Politely decline unrelated questions.',
    '- Recommend only over-the-counter cosmetic care and habits.',
    '- DO NOT diagnose, name any skin disease, or claim to treat, cure, or prevent anything.',
    '- For any concern about a specific spot, mole, or change in the skin, tell the user to see a ' +
      'board-certified dermatologist. Never assess it yourself.',
    '',
    `This user's skin reads (appearance only):\n${bandLines}`,
    `Skin type feel: ${SKIN_TYPE_LABELS[input.skinType]}`,
    `Their current routine:\n${renderRoutine(input.routine)}`,
  ].join('\n');

  const messages: ChatTurn[] = [...input.history, { role: 'user', content: input.message }];
  return { system, messages };
}
