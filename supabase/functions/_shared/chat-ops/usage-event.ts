// The restricted operational usage event (gap-9 §4). Numeric and enumerated fields only: it never
// carries message/history/reply/prompt text, raw user id, JWT, IP, headers, or provider error bodies.
import type { ChatOpsConfig } from './config.ts';
import { formatMicros, tokenCostMicros } from './money.ts';

export type Outcome =
  | 'success' | 'provider_error' | 'output_blocked' | 'cost_cap_breach' | 'medical_referral'
  | 'input_rejected' | 'quota_rejected' | 'rate_limited' | 'kill_switch' | 'unauthorized'
  | 'not_found' | 'unavailable';

export interface ProviderUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface UsageEvent {
  event_id: string; request_id: string; occurred_at: string;
  environment: string; function_revision: string; config_revision: string;
  user_key: string; model_id: string; model_pricing_revision: string;
  input_tokens: number | null; output_tokens: number | null;
  cache_creation_input_tokens: number | null; cache_read_input_tokens: number | null;
  usage_status: 'ok' | 'usage_unavailable';
  estimated_cost_usd: string; reserved_cost_usd: string; reservation_released_usd: string;
  outcome: Outcome; http_status: number; latency_ms: number;
  guard_reason: string | null; provider_request_attempted: boolean;
}

const count = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;

/** Sanitises provider usage to non-negative integers; anything else is treated as unavailable. */
export function readUsage(u: ProviderUsage | null | undefined): ProviderUsage | null {
  if (!u) return null;
  const input = count(u.input_tokens);
  const output = count(u.output_tokens);
  if (input === null || output === null) return null;
  return {
    input_tokens: input, output_tokens: output,
    cache_creation_input_tokens: count(u.cache_creation_input_tokens) ?? 0,
    cache_read_input_tokens: count(u.cache_read_input_tokens) ?? 0,
  };
}

export function actualCostMicros(cfg: ChatOpsConfig, usage: ProviderUsage | null): number {
  if (!usage) return cfg.reserveMicros;
  return tokenCostMicros(usage.input_tokens, usage.output_tokens, cfg.inputMicrosPerMTok, cfg.outputMicrosPerMTok);
}

/** True when the response exceeded any enforced per-message cap (§3.2, §5.1). */
export function isCapBreach(cfg: ChatOpsConfig, usage: ProviderUsage | null): boolean {
  if (!usage) return false;
  return usage.input_tokens > cfg.maxInputTokens
    || usage.output_tokens > cfg.maxOutputTokens
    || (usage.cache_creation_input_tokens ?? 0) > 0
    || (usage.cache_read_input_tokens ?? 0) > 0
    || actualCostMicros(cfg, usage) > cfg.reserveMicros;
}

export interface EventFacts {
  eventId: string; requestId: string; occurredAtMs: number; userKey: string;
  usage: ProviderUsage | null; outcome: Outcome; httpStatus: number; latencyMs: number;
  guardReason: string | null;
}

export function buildUsageEvent(cfg: ChatOpsConfig, f: EventFacts): UsageEvent {
  const actual = actualCostMicros(cfg, f.usage);
  return {
    event_id: f.eventId, request_id: f.requestId, occurred_at: new Date(f.occurredAtMs).toISOString(),
    environment: cfg.environment, function_revision: cfg.functionRevision, config_revision: cfg.configRevision,
    user_key: f.userKey, model_id: cfg.modelId, model_pricing_revision: cfg.pricingRevision,
    input_tokens: f.usage?.input_tokens ?? null, output_tokens: f.usage?.output_tokens ?? null,
    cache_creation_input_tokens: f.usage?.cache_creation_input_tokens ?? null,
    cache_read_input_tokens: f.usage?.cache_read_input_tokens ?? null,
    usage_status: f.usage ? 'ok' : 'usage_unavailable',
    estimated_cost_usd: formatMicros(actual),
    reserved_cost_usd: formatMicros(cfg.reserveMicros),
    reservation_released_usd: formatMicros(Math.max(0, cfg.reserveMicros - actual)),
    outcome: f.outcome, http_status: f.httpStatus, latency_ms: Math.max(0, Math.round(f.latencyMs)),
    guard_reason: f.guardReason, provider_request_attempted: true,
  };
}
