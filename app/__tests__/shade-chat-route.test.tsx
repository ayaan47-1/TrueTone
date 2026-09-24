import { render, screen } from '@testing-library/react-native';
import type { CurrentShade } from '../../src/features/session/personalization';

const mockPersonalization = jest.fn();
jest.mock('../../src/features/session/personalization', () => ({
  usePersonalization: () => mockPersonalization(),
}));
// Mock the makeup-chat client so the route test does not pull in Supabase.
jest.mock('../../src/lib/makeup-chat', () => ({ sendMakeupChat: jest.fn() }));

import ShadeChatRoute from '../scan/shade-chat';

const shade: CurrentShade = { shadeName: 'Medium Warm', undertone: 'warm', depth: 6, finish: 'natural' };

beforeEach(() => jest.clearAllMocks());

test('renders the makeup chat when a derived shade is present', async () => {
  mockPersonalization.mockReturnValue({ hasScanned: true, currentShade: shade });
  await render(<ShadeChatRoute />);
  expect(screen.getByPlaceholderText(/ask about your shade/i)).toBeTruthy();
});

test('renders a fallback (not the chat) when there is no shade yet', async () => {
  mockPersonalization.mockReturnValue({ hasScanned: false, currentShade: null });
  await render(<ShadeChatRoute />);
  expect(screen.getByText(/no shade yet/i)).toBeTruthy();
  expect(screen.queryByPlaceholderText(/ask about your shade/i)).toBeNull();
});
