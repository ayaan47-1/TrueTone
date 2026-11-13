import type { ScoreVector, SkinTypeFeel } from '../../read/read-types';
import type { Routine } from '../routine-types';
import { isMedicalQuery, REFERRAL_MESSAGE } from './refusal';
import { buildChatPrompt, type ChatTurn } from './prompt';
import { guardReply } from './guard';

export interface ScanContext { scores: ScoreVector; skinType: SkinTypeFeel; routine: Routine }
export interface ChatDeps {
  loadScan(scanId: string): Promise<ScanContext | null>;
  complete(system: string, messages: ChatTurn[]): Promise<string>;
  /** Per-user call quota (MASVS M3): resolves false when the caller has used today's allowance. */
  consumeQuota(): Promise<boolean>;
}
export interface ChatInput { scanId: string; message: string; history: ChatTurn[] }
export interface ChatOutput { reply: string; referred: boolean; blocked: boolean }

export async function handleChat(deps: ChatDeps, input: ChatInput): Promise<ChatOutput> {
  // Layer 2: refuse medical queries before any LLM call -- in the new message AND every user turn
  // of the client-supplied history, which a caller can fabricate (MASVS M3).
  const userTexts = [input.message, ...input.history.filter((t) => t.role === 'user').map((t) => t.content)];
  if (userTexts.some(isMedicalQuery)) {
    return { reply: REFERRAL_MESSAGE, referred: true, blocked: false };
  }
  // Layer 1: load the caller's own scan context (RLS enforced by the dep implementation).
  const ctx = await deps.loadScan(input.scanId);
  if (!ctx) throw new Error('scan-not-found');
  // Only a call that will reach the model counts against the caller's quota.
  if (!(await deps.consumeQuota())) throw new Error('rate-limited');

  // Layer 3: constrained prompt.
  const { system, messages } = buildChatPrompt({
    scores: ctx.scores, skinType: ctx.skinType, routine: ctx.routine,
    history: input.history, message: input.message,
  });
  const raw = await deps.complete(system, messages);

  // Layer 4: fail-closed output guard.
  const { safe, blocked } = guardReply(raw);
  return { reply: safe, referred: false, blocked };
}
