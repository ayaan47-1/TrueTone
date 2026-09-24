// src/lib/makeup-chat.ts
// Client transport for the makeup / shade Q&A domain. Sends ONLY the user's already-derived shade
// descriptors + structured preferences (WORDS, never the image, never the numeric depth on the
// wire beyond what the shade object carries) to our own `makeup-chat` edge function. Mirrors
// src/lib/routine-chat.ts. The reply is post-filtered server-side; nothing is persisted.
import { supabase } from './supabase';
import type { CurrentShade } from '../features/session/personalization';
import type { SetupAnswers } from '../features/preferences/preferences-types';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendMakeupChat(
  shade: CurrentShade,
  preferences: SetupAnswers,
  message: string,
  history: ChatTurn[],
): Promise<{ reply: string; referred: boolean }> {
  const { data, error } = await supabase.functions.invoke('makeup-chat', {
    body: { shade, preferences, message, history },
  });
  if (error || !data) throw new Error('chat-failed');
  return { reply: data.reply, referred: Boolean(data.referred) };
}
