import { sendChat } from '../routine-chat';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock('../../features/recommend/chat/availability', () => ({ ROUTINE_CHAT_AVAILABLE: true }));

test('sends only message/history and returns the reply', async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { reply: 'hi', referred: false }, error: null });
  const out = await sendChat('why SPF?', []);
  expect(out.reply).toBe('hi');
  const [name, opts] = (supabase.functions.invoke as jest.Mock).mock.calls[0];
  expect(name).toBe('routine-chat');
  expect(opts.body).toEqual({ message: 'why SPF?', history: [] });
});

test('throws chat-failed on transport error', async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error('x') });
  await expect(sendChat('hi', [])).rejects.toThrow('chat-failed');
});
