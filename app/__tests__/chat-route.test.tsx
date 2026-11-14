import { render, screen } from '@testing-library/react-native';

const mockParams = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams(),
}));
// Mock the chat client so the route test does not pull in Supabase.
jest.mock('../../src/lib/routine-chat', () => ({ sendChat: jest.fn() }));

import ChatRoute from '../scan/chat';

beforeEach(() => jest.clearAllMocks());

test('an old scan link cannot open the chat composer while external chat is unapproved', async () => {
  mockParams.mockReturnValue({ scanId: 's1' });
  await render(<ChatRoute />);
  expect(screen.getByText(/routine chat is not available yet/i)).toBeTruthy();
  expect(screen.queryByPlaceholderText(/ask about your routine/i)).toBeNull();
});

test('the unavailable state does not ask the user to scan or enter conversation text', async () => {
  mockParams.mockReturnValue({});
  await render(<ChatRoute />);
  expect(screen.getByText(/routine chat is not available yet/i)).toBeTruthy();
  expect(screen.queryByText(/run a scan/i)).toBeNull();
  expect(screen.queryByPlaceholderText(/ask about your routine/i)).toBeNull();
});
