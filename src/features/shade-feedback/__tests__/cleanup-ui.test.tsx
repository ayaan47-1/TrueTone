import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Consent } from '../../consent/Consent';
import { DataRights } from '../../data-rights/DataRights';
import { feedbackCleanup, localFeedback } from '../runtime';
import { FEEDBACK_CLEANUP_KEY } from '../cleanup';
import { useFeedbackCleanupLifecycle } from '../cleanup-lifecycle';

jest.mock('../../../lib/supabase', () => ({ SUPABASE_OFFLINE: true, CAMERA_DEMO: true, supabase: { rpc: jest.fn() } }));

afterEach(() => jest.restoreAllMocks());

test.each(['consent', 'data'])('pending cleanup survives navigation to %s and has a working retry', async (page) => {
  const wipe = jest.spyOn(localFeedback, 'clearAll').mockRejectedValue(new Error('locked'));
  await expect(feedbackCleanup.clear()).rejects.toThrow();
  const view = await render(page === 'consent'
    ? <Consent onConsent={jest.fn()} onDecline={jest.fn()} />
    : <DataRights onChanged={jest.fn()} confirm={async () => true} />);
  await waitFor(() => expect(wipe).toHaveBeenCalledTimes(2));
  expect(view.getByText(/Some local shade feedback could not be cleared/)).toBeTruthy();
  expect(await AsyncStorage.getItem(FEEDBACK_CLEANUP_KEY)).toBe('1');
  wipe.mockResolvedValue(undefined);
  await fireEvent.press(view.getByText('Retry feedback cleanup'));
  await waitFor(() => expect(view.queryByText(/Some local shade feedback could not be cleared/)).toBeNull());
  expect(await AsyncStorage.getItem(FEEDBACK_CLEANUP_KEY)).toBeNull();
  await view.unmount();
});

test('startup and foreground automatically retry local cleanup without a screen or network', async () => {
  const wipe = jest.spyOn(localFeedback, 'clearAll').mockRejectedValue(new Error('locked'));
  await expect(feedbackCleanup.clear()).rejects.toThrow();
  const listen = jest.spyOn(AppState, 'addEventListener');
  listen.mockClear();
  function App() { useFeedbackCleanupLifecycle(); return null; }
  const view = await render(<App />);
  await waitFor(() => expect(wipe).toHaveBeenCalledTimes(2));
  const listener = listen.mock.calls.find(([event]) => event === 'change')?.[1];
  expect(listener).toBeDefined();
  wipe.mockResolvedValue(undefined);
  await act(async () => { listener?.('active'); });
  await waitFor(() => expect(feedbackCleanup.getSnapshot()).toBe(false));
  expect(await AsyncStorage.getItem(FEEDBACK_CLEANUP_KEY)).toBeNull();
  await view.unmount();
});
