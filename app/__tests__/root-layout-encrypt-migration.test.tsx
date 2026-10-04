import { render, waitFor } from '@testing-library/react-native';

const mockMigrate = jest.fn(() => Promise.resolve());
jest.mock('../../src/lib/encrypted-storage', () => ({
  ...jest.requireActual('../../src/lib/encrypted-storage'),
  migrateLegacyPlaintext: () => mockMigrate(),
}));
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => ({ loading: true, error: null, route: 'home', refresh: jest.fn() }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  const Stack = Object.assign(() => <Text>stack</Text>, { Screen: () => null });
  return {
    Stack,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/',
  };
});
jest.mock('../../src/lib/supabase', () => ({ supabase: {}, DEMO_MODE: false }));

import RootLayout from '../_layout';

test('app start encrypts any plaintext left on the device by an older build, once', async () => {
  await render(<RootLayout />);
  await waitFor(() => expect(mockMigrate).toHaveBeenCalledTimes(1));
});
