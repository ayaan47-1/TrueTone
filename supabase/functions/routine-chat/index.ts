// DEVICE/DENO-ONLY SHELL — the only network/LLM piece. All real logic is handleGuardedChat
// (../_shared/chat-ops/handler.ts, Jest-tested with a mocked provider).
// Compliance: loads ONLY the caller's derived scores+routine under RLS; never an image. Anthropic key
// is server-side only (Supabase secret). Chat is ephemeral — no transcript is persisted; only the
// numeric usage event in chat_usage_events (gap-9 contract §4).
//
// Operations (gap-9 contract): DISABLED unless every CHAT_* setting is present and valid — see
// docs/ops/routine-chat-controls.md. The kill switch, verified JWT, bounds, rate limits and atomic
// cost reservation all run before the Anthropic client is constructed. Logs carry reason codes only.
//
// Import strategy: shared pure modules live in ../_shared/ (the Supabase cross-function pattern).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { handleGuardedChat, type GuardedChatDeps, type ProviderRequest } from '../_shared/chat-ops/handler.ts';
import { loadChatConfig, type ConfigResult } from '../_shared/chat-ops/config.ts';
import { supabaseQuotaStore } from '../_shared/chat-ops/supabase-store.ts';
import { hmacSha256Hex } from '../_shared/chat-ops/keyed-hash.ts';

const PROVIDER_TIMEOUT_MS = 30_000;
const env = (k: string) => Deno.env.get(k);

function readConfig(): ConfigResult {
  // Missing platform secrets are equivalent to disabled (§5.2).
  if (!env('ANTHROPIC_API_KEY') || !env('SUPABASE_URL') || !env('SUPABASE_ANON_KEY') || !env('SUPABASE_SERVICE_ROLE_KEY')) {
    return { state: 'disabled', reason: 'config_invalid' };
  }
  return loadChatConfig(env);
}

function clientIp(req: Request): string | null {
  const first = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return first ? first : null;
}

function buildDeps(authHeader: string | null): GuardedChatDeps {
  // Caller-scoped client -> RLS applies to the scan lookup and the JWT is verified by the auth server.
  const userClient = () => createClient(env('SUPABASE_URL')!, env('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader ?? '' } } });
  // Service-role client is used ONLY for the quota/usage RPCs, never for scan data.
  const service = () => createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!);
  return {
    config: readConfig,
    async verifyUser(header) {
      const token = header.replace(/^Bearer\s+/i, '').trim();
      if (!token) return null;
      const { data, error } = await userClient().auth.getUser(token);
      if (error) {
        const status = (error as { status?: number }).status ?? 500;
        if (status >= 500) throw new Error('auth-unavailable');
        return null;
      }
      return data.user?.id ?? null;
    },
    keyedHash: hmacSha256Hex,
    store: supabaseQuotaStore((fn, args) => service().rpc(fn, args)),
    async loadScan(scanId) {
      // RLS guarantees the row belongs to the caller; a non-owned id returns no row.
      const { data, error } = await userClient()
        .from('scans')
        .select('score_hydration,score_oiliness,score_texture,score_pores,score_dark_spots,score_redness,score_fine_lines,score_dark_circles,skin_type_feel,routine')
        .eq('id', scanId).maybeSingle();
      if (error) throw new Error('scan-lookup-failed');
      if (!data) return null;
      return {
        scores: {
          hydration: Number(data.score_hydration), oiliness: Number(data.score_oiliness),
          texture: Number(data.score_texture), pores: Number(data.score_pores),
          darkSpots: Number(data.score_dark_spots), redness: Number(data.score_redness),
          fineLines: Number(data.score_fine_lines), darkCircles: Number(data.score_dark_circles),
        },
        skinType: data.skin_type_feel,
        routine: data.routine,
      };
    },
    async callProvider(p: ProviderRequest) {
      // Constructed only after every guard has passed. maxRetries: 0 — a retry could double spend.
      const anthropic = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY')!, maxRetries: 0, timeout: PROVIDER_TIMEOUT_MS });
      const res = await anthropic.messages.create({
        model: p.model, max_tokens: p.max_tokens, system: p.system,
        messages: p.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const block = res.content.find((b) => b.type === 'text');
      return { text: block && block.type === 'text' ? block.text : '', usage: res.usage ?? null };
    },
    nowMs: () => Date.now(),
    newId: () => crypto.randomUUID(),
    // Reason codes only: never the message, reply, identifiers, headers, or provider error bodies.
    log: (line) => console.info(JSON.stringify({ fn: 'routine-chat', ...line })),
  };
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const authHeader = req.headers.get('Authorization');
  let body: unknown;
  try { body = await req.json(); } catch { body = undefined; }

  const out = await handleGuardedChat(buildDeps(authHeader), { authHeader, clientIp: clientIp(req), body });
  return out.json
    ? Response.json(out.json, { status: out.status, headers: out.headers })
    : new Response(out.text ?? '', { status: out.status, headers: out.headers });
});
