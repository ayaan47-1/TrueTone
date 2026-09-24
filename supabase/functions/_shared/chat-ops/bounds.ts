// Request-shape validation and aggregate input bound (gap-9 contract §3.2, §3.4).
// Everything here runs before any scan lookup or provider call.
import type { ChatTurn } from '../recommend/prompt.ts';

export const MAX_MESSAGE_CHARS = 2000;
export const MAX_HISTORY_TURNS = 20;
/** A prior 600-token assistant reply can exceed 2,000 chars; the aggregate cap still bounds the total. */
export const MAX_TURN_CHARS = 4000;
/** Fixed per-turn and per-request framing overhead added to the estimate. */
const TURN_OVERHEAD_TOKENS = 4;
const REQUEST_OVERHEAD_TOKENS = 8;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BODY_KEYS = new Set(['scanId', 'message', 'history']);

export interface ChatBody { scanId: string; message: string; history: ChatTurn[] }
export type BodyResult = { ok: true; value: ChatBody } | { ok: false };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function boundedText(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim() !== '' && v.length <= max;
}

function parseTurn(v: unknown): ChatTurn | null {
  if (!isRecord(v) || Object.keys(v).length !== 2) return null;
  if (v.role !== 'user' && v.role !== 'assistant') return null;
  if (!boundedText(v.content, MAX_TURN_CHARS)) return null;
  return { role: v.role, content: v.content };
}

export function validateChatBody(body: unknown): BodyResult {
  if (!isRecord(body) || Object.keys(body).some((k) => !BODY_KEYS.has(k))) return { ok: false };
  const { scanId, message, history = [] } = body;
  if (typeof scanId !== 'string' || !UUID.test(scanId)) return { ok: false };
  if (!boundedText(message, MAX_MESSAGE_CHARS)) return { ok: false };
  if (!Array.isArray(history) || history.length > MAX_HISTORY_TURNS) return { ok: false };
  const turns = history.map(parseTurn);
  if (turns.some((t) => t === null)) return { ok: false };
  return { ok: true, value: { scanId, message, history: turns as ChatTurn[] } };
}

/** Conservative estimate: ~3 characters per token over-counts typical English text. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export function estimatePromptTokens(system: string, messages: readonly ChatTurn[]): number {
  return messages.reduce(
    (sum, m) => sum + estimateTokens(m.content) + TURN_OVERHEAD_TOKENS,
    estimateTokens(system) + REQUEST_OVERHEAD_TOKENS,
  );
}
