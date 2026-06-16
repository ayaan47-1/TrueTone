// AsyncStorage's native module is null under Jest; mock it so the GoTrue client
// can construct without touching native storage.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import { supabase } from '../supabase';
test('supabase client exposes auth + rpc', () => {
  expect(supabase.auth).toBeDefined();
  expect(typeof supabase.rpc).toBe('function');
});
