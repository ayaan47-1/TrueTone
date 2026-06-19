import { supabase } from './supabase';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export async function sendChat(
  scanId: string, message: string, history: ChatTurn[],
): Promise<{ reply: string; referred: boolean }> {
  const { data, error } = await supabase.functions.invoke('routine-chat', {
    body: { scanId, message, history },
  });
  if (error || !data) throw new Error('chat-failed');
  return { reply: data.reply, referred: Boolean(data.referred) };
}
