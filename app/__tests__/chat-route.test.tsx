import { render, screen } from '@testing-library/react-native';

const mockParams = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams(),
}));
// Mock the chat client so the route test does not pull in Supabase.
jest.mock('../../src/lib/routine-chat', () => ({ sendChat: jest.fn() }));

import ChatRoute from '../scan/chat';

beforeEach(() => jest.clearAllMocks());

test('renders the chat when a scanId param is present', async () => {
  mockParams.mockReturnValue({ scanId: 's1' });
  await render(<ChatRoute />);
  expect(screen.getByPlaceholderText(/ask about your routine/i)).toBeTruthy();
});

test('renders a fallback (not the chat) when scanId is missing', async () => {
  mockParams.mockReturnValue({});
  await render(<ChatRoute />);
  expect(screen.getByText(/no scan yet/i)).toBeTruthy();
  expect(screen.queryByPlaceholderText(/ask about your routine/i)).toBeNull();
});
