import { isMedicalQuery, REFERRAL_MESSAGE } from './refusal';
import { buildChatPrompt, type ChatTurn } from './prompt';
import { guardReply } from './guard';

export interface ChatDeps {
  complete(system: string, messages: ChatTurn[]): Promise<string>;
  /** Per-user call quota (MASVS M3): resolves false when the caller has used today's allowance. */
  consumeQuota(): Promise<boolean>;
}
export interface ChatInput { message: string; history: ChatTurn[] }
export interface ChatOutput { reply: string; referred: boolean; blocked: boolean }

export async function handleChat(deps: ChatDeps, input: ChatInput): Promise<ChatOutput> {
  // Layer 2: refuse medical queries before any LLM call -- in the new message AND every user turn
  // of the client-supplied history, which a caller can fabricate (MASVS M3).
  const userTexts = [input.message, ...input.history.filter((t) => t.role === 'user').map((t) => t.content)];
  if (userTexts.some(isMedicalQuery)) {
    return { reply: REFERRAL_MESSAGE, referred: true, blocked: false };
  }
  // Only a call that will reach the model counts against the caller's quota.
  if (!(await deps.consumeQuota())) throw new Error('rate-limited');

  // Layer 3: constrained prompt.
  const { system, messages } = buildChatPrompt({
    history: input.history, message: input.message,
  });
  const raw = await deps.complete(system, messages);

  // Layer 4: fail-closed output guard.
  const { safe, blocked } = guardReply(raw);
  return { reply: safe, referred: false, blocked };
}
