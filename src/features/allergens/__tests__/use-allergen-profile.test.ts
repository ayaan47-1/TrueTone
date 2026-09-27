import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useAllergenProfile } from '../use-allergen-profile';
import { saveAllergenProfile } from '../allergen-store';
import { emptyProfile, toggleGroup } from '../profile';

const SecureStore = require('expo-secure-store');
const flags = toggleGroup(emptyProfile('yes', 't'), 'fragrance');
const realGet = SecureStore.getItemAsync.getMockImplementation();
afterEach(() => SecureStore.getItemAsync.mockImplementation(realGet));

function holdReads() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => { release = r; });
  const real = SecureStore.getItemAsync.getMockImplementation();
  SecureStore.getItemAsync.mockImplementation(async (k: string) => { await gate; return real(k); });
  return { release: () => { release(); SecureStore.getItemAsync.mockImplementation(real); } };
}

test('switching user never shows the previous user\'s profile (code review M5)', async () => {
  await saveAllergenProfile('u1', flags);
  const { result, rerender } = await renderHook(({ id }: { id: string }) => useAllergenProfile(id), {
    initialProps: { id: 'u1' },
  });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  const held = holdReads();
  await rerender({ id: 'u2' });
  expect(result.current.status).toBe('loading');
  await act(async () => held.release());
  await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', profile: null }));
});

test('a plain reload keeps showing the current data (no flicker)', async () => {
  await saveAllergenProfile('u1', flags);
  const { result } = await renderHook(() => useAllergenProfile('u1'));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  const held = holdReads();
  await act(async () => result.current.reload());
  expect(result.current.status).toBe('ready');
  await act(async () => held.release());
});
