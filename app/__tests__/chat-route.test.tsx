import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockParams = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams(),
  useRouter: () => ({ back: jest.fn() }),
}));
// Mock the chat client so the route test does not pull in Supabase.
jest.mock('../../src/lib/routine-chat', () => ({ sendChat: jest.fn() }));
const mockMaybeSingle = jest.fn();
const mockRpc = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args) }) }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import ChatRoute from '../scan/chat';

beforeEach(() => {
  jest.clearAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: { ai_consent_active: true }, error: null });
});

test('renders the chat when a scanId param is present', async () => {
  mockParams.mockReturnValue({ scanId: 's1' });
  await render(<ChatRoute />);
  expect(await screen.findByPlaceholderText(/ask about your routine/i)).toBeTruthy();
});

test('requires separate AI consent before rendering chat', async () => {
  mockParams.mockReturnValue({ scanId: 's1' });
  mockMaybeSingle.mockResolvedValue({ data: { ai_consent_active: false }, error: null });
  await render(<ChatRoute />);

  expect(await screen.findByText('Optional AI routine and chat')).toBeTruthy();
  expect(screen.queryByPlaceholderText(/ask about your routine/i)).toBeNull();
  await fireEvent.press(screen.getByTestId('ai-consent-check'));
  await fireEvent.press(screen.getByTestId('ai-consent-submit'));

  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('record_ai_consent'));
  expect(await screen.findByPlaceholderText(/ask about your routine/i)).toBeTruthy();
});

test('fails closed when AI consent state cannot be loaded', async () => {
  mockParams.mockReturnValue({ scanId: 's1' });
  mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('offline') });
  await render(<ChatRoute />);

  expect(await screen.findByText(/AI chat is unavailable/i)).toBeTruthy();
  expect(screen.queryByPlaceholderText(/ask about your routine/i)).toBeNull();
});

test('fails closed when loading AI consent rejects', async () => {
  mockParams.mockReturnValue({ scanId: 's1' });
  mockMaybeSingle.mockRejectedValue(new Error('offline'));
  await render(<ChatRoute />);

  expect(await screen.findByText(/AI chat is unavailable/i)).toBeTruthy();
  expect(screen.queryByPlaceholderText(/ask about your routine/i)).toBeNull();
});

test('renders a fallback (not the chat) when scanId is missing', async () => {
  mockParams.mockReturnValue({});
  await render(<ChatRoute />);
  expect(screen.getByText(/no scan yet/i)).toBeTruthy();
  expect(screen.queryByPlaceholderText(/ask about your routine/i)).toBeNull();
});
