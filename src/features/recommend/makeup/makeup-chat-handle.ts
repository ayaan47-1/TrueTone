// src/features/recommend/makeup/makeup-chat-handle.ts
// Orchestrates the makeup / shade Q&A turn with the SAME defense-in-depth layers as the skincare
// chat (src/features/recommend/chat/handle.ts) — it reuses the compliance-critical refusal and
// output-guard primitives rather than forking them:
//   Layer 2  input-side hard refuse of medical queries (before any LLM call)
//   Layer 1  load the user's derived shade context (no image ever)
//   Layer 3  constrained, cosmetic-only makeup prompt
//   Layer 4  fail-closed output guard (disease term -> safe fallback)
import { isMedicalQuery, REFERRAL_MESSAGE } from '../chat/refusal';
import { guardReply } from '../chat/guard';
import { buildMakeupChatPrompt, type ChatTurn, type MakeupChatContext } from './makeup-chat-prompt';

export type { MakeupChatContext } from './makeup-chat-prompt';

export interface MakeupChatDeps {
  /** Loads the caller's derived shade + preferences. Returns null when no shade is available. */
  loadContext(): Promise<MakeupChatContext | null>;
  complete(system: string, messages: ChatTurn[]): Promise<string>;
}

export interface MakeupChatInput {
  message: string;
  history: ChatTurn[];
}

export interface MakeupChatOutput {
  reply: string;
  referred: boolean;
  blocked: boolean;
}

export async function handleMakeupChat(
  deps: MakeupChatDeps,
  input: MakeupChatInput,
): Promise<MakeupChatOutput> {
  // Layer 2: refuse medical queries before any LLM call.
  if (isMedicalQuery(input.message)) {
    return { reply: REFERRAL_MESSAGE, referred: true, blocked: false };
  }
  // Layer 1: load the caller's own derived shade context (descriptors only, never the image).
  const ctx = await deps.loadContext();
  if (!ctx) throw new Error('shade-not-found');

  // Layer 3: constrained, cosmetic-only prompt (ranking stays out of the model).
  const { system, messages } = buildMakeupChatPrompt({
    shade: ctx.shade,
    preferences: ctx.preferences,
    history: input.history,
    message: input.message,
  });
  const raw = await deps.complete(system, messages);

  // Layer 4: fail-closed output guard.
  const { safe, blocked } = guardReply(raw);
  return { reply: safe, referred: false, blocked };
}
