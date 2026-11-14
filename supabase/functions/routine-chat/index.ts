// DEVICE/DENO-ONLY SHELL — the only network/LLM piece. All real logic is handleChat (Jest-tested).
// H1: no scan/profile/routine lookup. Only bounded conversation text may reach completion.
// External chat remains disabled until separate consent, disclosures and processor approval land.
//
// Import strategy: shared pure modules are copied into ../_shared/recommend/ (source of truth:
// src/features/recommend/chat/ + src/lib/cosmetic-filter.ts + src/content/cosmetic-vocab.ts).
// Relative paths reaching outside supabase/functions/ are not confirmed supported by the Supabase
// bundler (docs consistently show _shared/ as the cross-function sharing pattern), so the _shared
// fallback from the task brief is used here.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createChatEndpoint } from '../_shared/recommend/endpoint.ts';
import { ROUTINE_CHAT_AVAILABLE } from '../_shared/recommend/availability.ts';

const MODEL = 'claude-sonnet-4-6';

serve(createChatEndpoint({
  // Deliberately not an environment switch. Activation requires a reviewed consent implementation.
  enabled: ROUTINE_CHAT_AVAILABLE,
  logFailure: (kind) => console.error(JSON.stringify({ function: 'routine-chat', kind })),
  createDeps(authHeader) {
    // Only the existing authenticated quota RPC is needed. No scan/profile/routine query.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
    return {
      async consumeQuota() {
        // Per-user daily limit (migration 0042). Any RPC failure fails closed: no model call.
        const { data, error } = await supabase.rpc('consume_chat_quota');
        return !error && data === true;
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
  },
}));
