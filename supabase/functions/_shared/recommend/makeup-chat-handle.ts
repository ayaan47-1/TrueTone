// SOURCE OF TRUTH: src/features/recommend/makeup/makeup-chat-handle.ts — kept in sync manually.
// Same defense-in-depth layers as the skincare chat, reusing the shared refusal + output guard:
//   Layer 2 refuse medical queries before the LLM; Layer 1 load derived shade context;
//   Layer 3 constrained cosmetic-only prompt; Layer 4 fail-closed output guard.
import { isMedicalQuery, REFERRAL_MESSAGE } from './refusal.ts';
import { guardReply } from './guard.ts';
import { buildMakeupChatPrompt, type ChatTurn, type MakeupChatContext } from './makeup-chat-prompt.ts';

export type { MakeupChatContext } from './makeup-chat-prompt.ts';

export interface MakeupChatDeps {
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
  if (isMedicalQuery(input.message)) {
    return { reply: REFERRAL_MESSAGE, referred: true, blocked: false };
  }
  const ctx = await deps.loadContext();
  if (!ctx) throw new Error('shade-not-found');

  const { system, messages } = buildMakeupChatPrompt({
    shade: ctx.shade,
    preferences: ctx.preferences,
    history: input.history,
    message: input.message,
  });
  const raw = await deps.complete(system, messages);

  const { safe, blocked } = guardReply(raw);
  return { reply: safe, referred: false, blocked };
}
