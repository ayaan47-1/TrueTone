// SOURCE OF TRUTH: src/features/recommend/chat/validate.ts — this copy is kept in sync manually.
// MASVS M3: boundary validation for routine-chat requests. Only a bounded list of plain-text
// user/assistant turns reaches the model: no system/tool roles, no content blocks, no extra fields.
import type { ChatTurn } from './prompt.ts';

export const MAX_TURN_CHARS = 2000;
export const MAX_HISTORY_TURNS = 20;
export const MAX_HISTORY_CHARS = 12000;

export interface ChatRequest { scanId: string; message: string; history: ChatTurn[] }
export type ParseResult = { ok: true; value: ChatRequest } | { ok: false };

const FAIL: ParseResult = { ok: false };

function parseTurn(raw: unknown): ChatTurn | null {
  if (!raw || typeof raw !== 'object') return null;
  const { role, content } = raw as Record<string, unknown>;
  if (role !== 'user' && role !== 'assistant') return null;
  if (typeof content !== 'string' || content.length > MAX_TURN_CHARS) return null;
  return { role, content };
}

function parseHistory(raw: unknown): ChatTurn[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_HISTORY_TURNS) return null;
  const turns = raw.map(parseTurn);
  if (turns.some((t) => t === null)) return null;
  const valid = turns as ChatTurn[];
  const total = valid.reduce((n, t) => n + t.content.length, 0);
  return total > MAX_HISTORY_CHARS ? null : valid;
}

export function parseChatRequest(body: unknown): ParseResult {
  if (!body || typeof body !== 'object') return FAIL;
  const { scanId, message, history } = body as Record<string, unknown>;
  if (typeof scanId !== 'string' || scanId === '' || scanId.length > 64) return FAIL;
  if (typeof message !== 'string' || message.trim() === '' || message.length > MAX_TURN_CHARS) return FAIL;
  const turns = parseHistory(history);
  if (!turns) return FAIL;
  return { ok: true, value: { scanId, message, history: turns } };
}
