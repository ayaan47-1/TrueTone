import { supabase, SUPABASE_OFFLINE } from './supabase';
import { ROUTINE_CHAT_AVAILABLE } from '../features/recommend/chat/availability';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export async function sendChat(
  message: string, history: ChatTurn[],
): Promise<{ reply: string; referred: boolean }> {
  // The camera build has no backend; chat fails closed (ChatScreen shows its error state).
  if (SUPABASE_OFFLINE) throw new Error('chat-offline');
  if (!ROUTINE_CHAT_AVAILABLE) throw new Error('chat-unavailable');
  const { data, error } = await supabase.functions.invoke('routine-chat', {
    body: { message, history: history.map(({ role, content }) => ({ role, content })) },
  });
  if (error || !data) throw new Error('chat-failed');
  return { reply: data.reply, referred: Boolean(data.referred) };
}
