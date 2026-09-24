// SOURCE OF TRUTH: src/features/recommend/makeup/makeup-chat-prompt.ts — kept in sync manually.
// Constrained, cosmetic-only makeup / shade system prompt. Context is WORDS only (derived shade
// descriptors + structured preferences); the numeric shade depth and the image never cross here.
// The model is told NOT to rank products — ranking is the deterministic match engine's job.
import {
  GOAL_LABELS,
  COVERAGE_LABELS,
  SKIP_LABELS,
  FINISH_LABELS,
  UNDERTONE_LABELS,
} from './makeup-vocab.ts';
import type { CurrentShade, SetupAnswers } from './makeup-types.ts';
import type { ChatTurn } from './prompt.ts';

export type { ChatTurn } from './prompt.ts';

export interface MakeupChatContext {
  shade: CurrentShade;
  preferences: SetupAnswers;
}

export interface MakeupPromptInput extends MakeupChatContext {
  history: ChatTurn[];
  message: string;
}

function joinLabels(values: readonly string[], empty: string): string {
  return values.length > 0 ? values.join(', ') : empty;
}

export function buildMakeupChatPrompt(input: MakeupPromptInput): { system: string; messages: ChatTurn[] } {
  const { shade, preferences } = input;
  const goals = joinLabels(preferences.goals.map((g) => GOAL_LABELS[g]), 'None set');
  const skips = joinLabels(preferences.skips.map((s) => SKIP_LABELS[s]), 'None');

  const system = [
    "You are TrueTone's cosmetic makeup and shade assistant. You describe how makeup LOOKS and how " +
      'a foundation shade, undertone, and finish fit a person. You are NOT a medical professional.',
    'Rules you MUST follow:',
    '- Describe appearance and fit only, using everyday cosmetic language.',
    "- Only answer about THIS user's shade and makeup preferences below. Politely decline unrelated questions.",
    '- Talk about brand-neutral makeup: foundation shade, undertone, finish, coverage, and how to wear them.',
    '- DO NOT rank, score, or recommend specific products. The app\'s shade-match shelf already does that ' +
      'deterministically; point the user there instead of naming or ordering products yourself.',
    '- DO NOT diagnose, name any skin disease, or claim a product treats, cures, prevents, or changes the skin.',
    '- For any concern about a specific spot, mole, or change in the skin, tell the user to see a ' +
      'board-certified dermatologist. Never assess it yourself.',
    '',
    "This user's shade (appearance only): " +
      `${shade.shadeName}, ${UNDERTONE_LABELS[shade.undertone]} undertone, ${FINISH_LABELS[shade.finish]} finish.`,
    `Coverage they like: ${COVERAGE_LABELS[preferences.coverage]}.`,
    `Their makeup goals: ${goals}.`,
    `Things to skip: ${skips}.`,
  ].join('\n');

  const messages: ChatTurn[] = [...input.history, { role: 'user', content: input.message }];
  return { system, messages };
}
