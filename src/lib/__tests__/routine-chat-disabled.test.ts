import { sendChat } from '../routine-chat';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

test('chat is unavailable without sending even a text-only request to the backend', async () => {
  await expect(sendChat('What does a cleanser do?', [])).rejects.toThrow('chat-unavailable');
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
