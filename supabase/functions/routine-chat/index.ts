// DEVICE/DENO-ONLY SHELL — the only network/LLM piece. All real logic is handleChat (Jest-tested).
// Compliance: loads ONLY the caller's derived scores+routine under RLS; never an image. Anthropic key
// is server-side only (Supabase secret). Chat is ephemeral — nothing is persisted.
//
// Import strategy: shared pure modules are copied into ../_shared/recommend/ (source of truth:
// src/features/recommend/chat/ + src/lib/cosmetic-filter.ts + src/content/cosmetic-vocab.ts).
// Relative paths reaching outside supabase/functions/ are not confirmed supported by the Supabase
// bundler (docs consistently show _shared/ as the cross-function sharing pattern), so the _shared
// fallback from the task brief is used here.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { handleChat, type ChatDeps } from '../_shared/recommend/handle.ts';
import type { ChatTurn } from '../_shared/recommend/prompt.ts';

const MODEL = 'claude-sonnet-4-6';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('unauthorized', { status: 401 });

  // Client scoped to the caller's JWT -> RLS applies to every query.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  let body: { scanId?: string; message?: string; history?: unknown };
  try { body = await req.json(); } catch { return new Response('bad request', { status: 400 }); }

  // Input bounds: reject missing/empty/oversized message and malformed/oversized history.
  // (The output guard backstops content regardless, but we bound sizes at the boundary.)
  if (!body.scanId || !body.message) return new Response('bad request', { status: 400 });
  if (typeof body.message !== 'string' || body.message.trim() === '' || body.message.length > 2000) {
    return new Response('bad request', { status: 400 });
  }
  if (body.history !== undefined) {
    if (!Array.isArray(body.history) || body.history.length > 20) {
      return new Response('bad request', { status: 400 });
    }
  }

  const deps: ChatDeps = {
    async loadScan(scanId) {
      // RLS guarantees the row belongs to the caller; a non-owned id returns no row.
      const { data } = await supabase
        .from('scans')
        .select('score_hydration,score_oiliness,score_texture,score_pores,score_dark_spots,score_redness,score_fine_lines,score_dark_circles,skin_type_feel,routine')
        .eq('id', scanId).maybeSingle();
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
    async complete(system, messages) {
      const res = await anthropic.messages.create({
        model: MODEL, max_tokens: 600, system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const block = res.content[0];
      return block && block.type === 'text' ? block.text : '';
    },
  };

  try {
    const out = await handleChat(deps, {
      scanId: body.scanId,
      message: body.message,
      history: (body.history as ChatTurn[] | undefined) ?? [],
    });
    if (out.blocked) console.warn('routine-chat: output blocked by post-filter');
    return Response.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    if (msg === 'scan-not-found') return new Response('not found', { status: 404 });
    console.error('routine-chat: chat failed', e instanceof Error ? e.message : 'unknown');
    return new Response('chat unavailable', { status: 502 });
  }
});
