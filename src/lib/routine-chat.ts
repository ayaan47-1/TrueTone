import { supabase, SUPABASE_OFFLINE } from './supabase';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export async function sendChat(
  scanId: string, message: string, history: ChatTurn[],
): Promise<{ reply: string; referred: boolean }> {
  // The camera build has no backend; chat fails closed (ChatScreen shows its error state).
  if (SUPABASE_OFFLINE) throw new Error('chat-offline');
  const { data, error } = await supabase.functions.invoke('routine-chat', {
    body: { scanId, message, history },
  });
  if (error || !data) throw new Error('chat-failed');
  return { reply: data.reply, referred: Boolean(data.referred) };
}
