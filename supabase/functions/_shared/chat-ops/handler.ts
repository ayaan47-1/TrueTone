// Guarded routine-chat request pipeline (gap-9 contract). Pure orchestration with injected deps so
// every control is provable with a mocked provider. Order: kill switch → identity → schema →
// attempt limits → medical refusal → scan (RLS) → aggregate bound → atomic reservation →
// ONE provider call (no retry) → output guard → usage event → reply.
import type { ChatTurn } from '../recommend/prompt.ts';
import { buildChatPrompt } from '../recommend/prompt.ts';
import { isMedicalQuery, REFERRAL_MESSAGE } from '../recommend/refusal.ts';
import { guardReply } from '../recommend/guard.ts';
import type { ScanContext, ChatOutput } from '../recommend/handle.ts';
import type { ChatOpsConfig, ConfigResult } from './config.ts';
import { validateChatBody, estimatePromptTokens } from './bounds.ts';
import type { QuotaStore } from './quota-store.ts';
import {
  buildUsageEvent, readUsage, actualCostMicros, isCapBreach,
  type Outcome, type ProviderUsage,
} from './usage-event.ts';

export interface ProviderRequest { model: string; max_tokens: number; system: string; messages: ChatTurn[] }
export interface ProviderResult { text: string; usage: ProviderUsage | null }

export interface GuardedChatDeps {
  config(): ConfigResult;
  /** Verifies the JWT with the auth server; returns the user id, or null when invalid. */
  verifyUser(authHeader: string): Promise<string | null>;
  keyedHash(value: string, secret: string): Promise<string>;
  store: QuotaStore;
  /** Caller-scoped (RLS) scan lookup; a non-owned id returns null. */
  loadScan(scanId: string): Promise<ScanContext | null>;
  callProvider(req: ProviderRequest): Promise<ProviderResult>;
  nowMs(): number;
  newId(): string;
  /** Reason-code-only operational log line. */
  log(line: OpsLogLine): void;
}
export interface OpsLogLine { outcome: Outcome; http_status: number; guard_reason: string | null; provider_request_attempted: boolean }
export interface ChatRequest { authHeader: string | null; clientIp: string | null; body: unknown }
export interface ChatResponse { status: number; text?: string; json?: ChatOutput; headers?: Record<string, string> }

const TEXT: Record<number, string> = {
  400: 'bad request', 401: 'unauthorized', 404: 'not found', 413: 'message too long',
  429: 'too many requests', 503: 'chat unavailable',
};

function respond(deps: GuardedChatDeps, status: number, outcome: Outcome, reason: string | null,
  extra: Partial<ChatResponse> = {}, attempted = false): ChatResponse {
  deps.log({ outcome, http_status: status, guard_reason: reason, provider_request_attempted: attempted });
  return extra.json ? { status, ...extra } : { status, text: TEXT[status], ...extra };
}
const retryAfter = (sec: number) => ({ 'Retry-After': String(Math.max(1, Math.ceil(sec))) });

function safeConfig(deps: GuardedChatDeps): ConfigResult {
  try { return deps.config(); } catch { return { state: 'disabled', reason: 'config_invalid' }; }
}

export async function handleGuardedChat(deps: GuardedChatDeps, req: ChatRequest): Promise<ChatResponse> {
  const cfgResult = safeConfig(deps);
  if (cfgResult.state !== 'enabled') return respond(deps, 503, 'kill_switch', cfgResult.reason);
  const cfg = cfgResult.config;

  if (!req.authHeader) return respond(deps, 401, 'unauthorized', 'missing_auth');
  try {
    const userId = await deps.verifyUser(req.authHeader);
    if (!userId) return respond(deps, 401, 'unauthorized', 'invalid_auth');
    return await authorised(deps, cfg, req, userId);
  } catch {
    // Any dependency failure (auth, quota store, scan lookup) fails closed without detail.
    return respond(deps, 503, 'unavailable', 'dependency_unavailable');
  }
}

async function authorised(deps: GuardedChatDeps, cfg: ChatOpsConfig, req: ChatRequest, userId: string): Promise<ChatResponse> {
  const parsed = validateChatBody(req.body);
  if (!parsed.ok) return respond(deps, 400, 'input_rejected', 'invalid_body');
  const { scanId, message, history } = parsed.value;

  const userKey = await deps.keyedHash(`user:${userId}`, cfg.userKeySecret);
  const ipKey = req.clientIp ? await deps.keyedHash(`ip:${req.clientIp}`, cfg.userKeySecret) : null;
  const gate = await deps.store.noteAttempt({ userKey, ipKey, userMax: cfg.attemptWindowMax, ipMax: cfg.ipWindowMax });
  if (!gate.ok) return respond(deps, 429, 'rate_limited', 'attempt_limit', { headers: retryAfter(gate.retryAfterSec) });

  if (isMedicalQuery(message)) {
    return respond(deps, 200, 'medical_referral', 'medical_referral', { json: { reply: REFERRAL_MESSAGE, referred: true, blocked: false } });
  }

  const ctx = await deps.loadScan(scanId);
  if (!ctx) return respond(deps, 404, 'not_found', 'scan_not_found');

  const { system, messages } = buildChatPrompt({ ...ctx, history, message });
  if (estimatePromptTokens(system, messages) > cfg.maxInputTokens) {
    return respond(deps, 413, 'input_rejected', 'aggregate_input_cap');
  }
  return reserveAndCall(deps, cfg, { userId, userKey, system, messages });
}

interface CallPlan { userId: string; userKey: string; system: string; messages: ChatTurn[] }

async function reserveAndCall(deps: GuardedChatDeps, cfg: ChatOpsConfig, p: CallPlan): Promise<ChatResponse> {
  const requestId = deps.newId();
  const r = await deps.store.reserve({
    userId: p.userId, userKey: p.userKey, requestId, reserveMicros: cfg.reserveMicros,
    shortWindowMax: cfg.shortWindowMax, userDailyCalls: cfg.userDailyCalls,
    userDailyMicros: cfg.userDailyMicros, globalDailyMicros: cfg.globalDailyMicros,
  });
  if (!r.ok) {
    if (r.reason === 'cost_killed') return respond(deps, 503, 'kill_switch', 'cost_killed');
    return respond(deps, 429, 'quota_rejected', r.reason, { headers: retryAfter(r.retryAfterSec) });
  }

  const started = deps.nowMs();
  let result: ProviderResult | null = null;
  try {
    // Exactly one attempt: a retry could double spend (§3.2).
    result = await deps.callProvider({ model: cfg.modelId, max_tokens: cfg.maxOutputTokens, system: p.system, messages: p.messages });
  } catch {
    result = null;
  }
  const usage = result ? readUsage(result.usage) : null;
  const breach = isCapBreach(cfg, usage);
  const guarded = result && !breach ? guardReply(result.text) : null;
  const [outcome, status, reason]: [Outcome, number, string | null] =
    !result ? ['provider_error', 503, 'provider_error']
      : breach ? ['cost_cap_breach', 503, 'cost_cap_breach']
        : guarded!.blocked ? ['output_blocked', 200, 'output_blocked'] : ['success', 200, null];

  const event = buildUsageEvent(cfg, {
    eventId: deps.newId(), requestId, occurredAtMs: deps.nowMs(), userKey: p.userKey, usage,
    outcome, httpStatus: status, latencyMs: deps.nowMs() - started, guardReason: reason,
  });
  // The reply is released only after its usage event is persisted (§4); a write failure throws → 503.
  await deps.store.settle({ reservationId: r.reservationId, actualMicros: actualCostMicros(cfg, usage), breach, event });

  if (status !== 200) return respond(deps, status, outcome, reason, {}, true);
  return respond(deps, 200, outcome, reason, { json: { reply: guarded!.safe, referred: false, blocked: guarded!.blocked } }, true);
}
