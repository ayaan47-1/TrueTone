// MASVS L1: a release build must never fall back to plain-HTTP localhost when the Supabase URL is
// missing; it fails closed at startup instead. Dev, Jest and the offline/demo builds keep the
// local default.
import { resolveSupabaseUrl, LOCAL_SUPABASE_URL } from '../supabase-url';

const base = { offline: false, demo: false, isDev: false };

test('a release build uses the configured https URL', () => {
  expect(resolveSupabaseUrl({ ...base, envUrl: 'https://abc.supabase.co' })).toBe('https://abc.supabase.co');
});

test('a release build with no URL throws instead of falling back to localhost', () => {
  expect(() => resolveSupabaseUrl({ ...base, envUrl: undefined })).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  expect(() => resolveSupabaseUrl({ ...base, envUrl: '  ' })).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
});

test('a release build with a plain-http URL throws', () => {
  expect(() => resolveSupabaseUrl({ ...base, envUrl: 'http://abc.supabase.co' })).toThrow(/https/);
});

test('dev builds keep the local fallback and may use http', () => {
  expect(resolveSupabaseUrl({ ...base, isDev: true, envUrl: undefined })).toBe(LOCAL_SUPABASE_URL);
  expect(resolveSupabaseUrl({ ...base, isDev: true, envUrl: 'http://192.168.1.5:54321' })).toBe('http://192.168.1.5:54321');
});

test('offline (camera) builds always use the unreachable local URL, ignoring env', () => {
  expect(resolveSupabaseUrl({ ...base, offline: true, envUrl: 'https://prod.supabase.co' })).toBe(LOCAL_SUPABASE_URL);
});

test('demo builds never call the backend, so a missing URL is allowed', () => {
  expect(resolveSupabaseUrl({ ...base, demo: true, envUrl: undefined })).toBe(LOCAL_SUPABASE_URL);
});
