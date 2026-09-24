// DEVICE/DENO-ONLY SHELL — the only network/LLM piece for the makeup / shade Q&A domain. All real
// logic is handleMakeupChat (Jest-tested via the src source-of-truth copy). Compliance: the context
// is the caller's OWN already-derived shade descriptors + preferences (WORDS only), supplied in the
// request body — never an image, never bytes. Anthropic key is server-side only. Chat is ephemeral;
// nothing is persisted. Import strategy mirrors routine-chat: shared pure modules live in
// ../_shared/recommend/ (source of truth under src/features/recommend/makeup/ + makeup-vocab.ts).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { handleMakeupChat, type MakeupChatDeps } from '../_shared/recommend/makeup-chat-handle.ts';
import type { ChatTurn } from '../_shared/recommend/makeup-chat-prompt.ts';
import type { CurrentShade, SetupAnswers } from '../_shared/recommend/makeup-types.ts';
import {
  GOALS,
  COVERAGES,
  SKIPS,
  FINISHES,
  UNDERTONES,
} from '../_shared/recommend/makeup-vocab.ts';

const MODEL = 'claude-sonnet-4-6';

// Defense-in-depth: the shade/preferences arrive from the client, so validate every field against
// the closed vocab and bound the one free-ish string (shadeName) before it reaches the prompt.
function parseShade(raw: unknown): CurrentShade | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const shadeName = typeof s.shadeName === 'string' ? s.shadeName.replace(/\s+/g, ' ').trim() : '';
  if (!shadeName || shadeName.length > 40) return null;
  if (!UNDERTONES.includes(s.undertone as never)) return null;
  if (!FINISHES.includes(s.finish as never)) return null;
  if (typeof s.depth !== 'number' || !Number.isFinite(s.depth)) return null;
  return {
    shadeName,
    undertone: s.undertone as CurrentShade['undertone'],
    finish: s.finish as CurrentShade['finish'],
    depth: s.depth,
  };
}

function parsePreferences(raw: unknown): SetupAnswers | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (!COVERAGES.includes(p.coverage as never)) return null;
  const goals = Array.isArray(p.goals) ? p.goals : [];
  const skips = Array.isArray(p.skips) ? p.skips : [];
  if (!goals.every((g) => GOALS.includes(g as never))) return null;
  if (!skips.every((k) => SKIPS.includes(k as never))) return null;
  return {
    coverage: p.coverage as SetupAnswers['coverage'],
    goals: goals as SetupAnswers['goals'],
    skips: skips as SetupAnswers['skips'],
  };
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('unauthorized', { status: 401 });

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  let body: { shade?: unknown; preferences?: unknown; message?: unknown; history?: unknown };
  try { body = await req.json(); } catch { return new Response('bad request', { status: 400 }); }

  if (typeof body.message !== 'string' || body.message.trim() === '' || body.message.length > 2000) {
    return new Response('bad request', { status: 400 });
  }
  if (body.history !== undefined) {
    if (!Array.isArray(body.history) || body.history.length > 20) {
      return new Response('bad request', { status: 400 });
    }
  }
  const shade = parseShade(body.shade);
  const preferences = parsePreferences(body.preferences);
  if (!shade || !preferences) return new Response('bad request', { status: 400 });

  const deps: MakeupChatDeps = {
    // The caller's own derived descriptors — validated above; no image, no DB read needed.
    async loadContext() {
      return { shade, preferences };
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
    const out = await handleMakeupChat(deps, {
      message: body.message,
      history: (body.history as ChatTurn[] | undefined) ?? [],
    });
    if (out.blocked) console.warn('makeup-chat: output blocked by post-filter');
    return Response.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    if (msg === 'shade-not-found') return new Response('not found', { status: 404 });
    console.error('makeup-chat: chat failed', e instanceof Error ? e.message : 'unknown');
    return new Response('chat unavailable', { status: 502 });
  }
});
