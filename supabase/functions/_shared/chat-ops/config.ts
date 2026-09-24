// Server-only runtime configuration for routine-chat (gap-9 contract §3, §5.2).
// Fail closed: the feature is DISABLED unless every value is present, well-formed, and inside the
// contract ceilings. No value here may come from the client.
import { parseUsdToMicros, tokenCostMicros } from './money.ts';

/** The only model this feature may call. A change needs an owner-approved evaluation (§3.1). */
export const PINNED_MODEL_ID = 'claude-sonnet-4-6';
/** Contract ceilings: configuration may tighten these, never loosen them. */
export const CEILING_OUTPUT_TOKENS = 600;
export const CEILING_INPUT_TOKENS = 3000;

export interface ChatOpsConfig {
  modelId: string;
  maxOutputTokens: number;
  maxInputTokens: number;
  reserveMicros: number;
  userDailyCalls: number;
  userDailyMicros: number;
  globalDailyMicros: number;
  shortWindowMax: number;
  attemptWindowMax: number;
  ipWindowMax: number;
  pricingRevision: string;
  inputMicrosPerMTok: number;
  outputMicrosPerMTok: number;
  configRevision: string;
  functionRevision: string;
  environment: string;
  userKeySecret: string;
}

export type DisabledReason = 'manual_off' | 'cost_killed' | 'config_invalid';
export type ConfigResult =
  | { state: 'enabled'; config: ChatOpsConfig }
  | { state: 'disabled'; reason: DisabledReason };

type Env = (key: string) => string | undefined;

const REVISION = /^[A-Za-z0-9._:-]{1,64}$/;

function posInt(v: string | undefined, max: number): number | null {
  if (v === undefined || !/^\d{1,9}$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= max ? n : null;
}
function money(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = parseUsdToMicros(v);
  return n !== null && n > 0 ? n : null;
}
function revision(v: string | undefined): string | null {
  return v !== undefined && REVISION.test(v) ? v : null;
}

function readConfig(env: Env): ChatOpsConfig | null {
  const c = {
    modelId: env('CHAT_MODEL_ID') === PINNED_MODEL_ID ? PINNED_MODEL_ID : null,
    maxOutputTokens: posInt(env('CHAT_MAX_OUTPUT_TOKENS'), CEILING_OUTPUT_TOKENS),
    maxInputTokens: posInt(env('CHAT_MAX_INPUT_TOKENS'), CEILING_INPUT_TOKENS),
    reserveMicros: money(env('CHAT_RESERVE_USD')),
    userDailyCalls: posInt(env('CHAT_USER_DAILY_CALLS'), 10_000),
    userDailyMicros: money(env('CHAT_USER_DAILY_USD')),
    globalDailyMicros: money(env('CHAT_GLOBAL_DAILY_USD')),
    shortWindowMax: posInt(env('CHAT_SHORT_WINDOW_MAX'), 10_000),
    attemptWindowMax: posInt(env('CHAT_ATTEMPT_WINDOW_MAX'), 10_000),
    ipWindowMax: posInt(env('CHAT_IP_WINDOW_MAX'), 10_000),
    pricingRevision: revision(env('CHAT_PRICING_REVISION')),
    inputMicrosPerMTok: money(env('CHAT_PRICE_INPUT_USD_PER_MTOK')),
    outputMicrosPerMTok: money(env('CHAT_PRICE_OUTPUT_USD_PER_MTOK')),
    configRevision: revision(env('CHAT_CONFIG_REVISION')),
    functionRevision: revision(env('CHAT_FUNCTION_REVISION')),
    environment: revision(env('CHAT_ENVIRONMENT')),
    userKeySecret: (env('CHAT_USER_KEY_SECRET') ?? '').length >= 32 ? env('CHAT_USER_KEY_SECRET')! : null,
  };
  if (Object.values(c).some((v) => v === null)) return null;
  const cfg = c as ChatOpsConfig;
  // The per-call reservation must cover the worst-case bounded call, or a call could overspend.
  const ceiling = tokenCostMicros(cfg.maxInputTokens, cfg.maxOutputTokens, cfg.inputMicrosPerMTok, cfg.outputMicrosPerMTok);
  if (cfg.reserveMicros < ceiling) return null;
  return cfg;
}

export function loadChatConfig(env: Env): ConfigResult {
  try {
    if (env('CHAT_ENABLED') !== 'true') return { state: 'disabled', reason: 'manual_off' };
    const killed = env('CHAT_COST_KILLED');
    if (killed === 'true') return { state: 'disabled', reason: 'cost_killed' };
    if (killed !== 'false') return { state: 'disabled', reason: 'config_invalid' };
    const config = readConfig(env);
    return config ? { state: 'enabled', config } : { state: 'disabled', reason: 'config_invalid' };
  } catch {
    return { state: 'disabled', reason: 'config_invalid' };
  }
}
