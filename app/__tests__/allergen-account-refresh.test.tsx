// Account → "{n} flagged" must stay current: tab screens stay mounted, so a count read once on
// mount goes stale after the user edits flags in the editor and comes back (design §8 P1).
import { render, act } from '@testing-library/react-native';
import { saveAllergenProfile } from '../../src/features/allergens/allergen-store';
import { emptyProfile, toggleGroup } from '../../src/features/allergens/profile';

let mockFocus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    mockFocus = cb;
  },
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: null, nativeBuildVersion: null }), { virtual: true });
jest.mock('../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => ({ userId: 'u1', loading: false, error: false, route: 'home', refresh: jest.fn() }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../src/features/identity/use-community-profile', () => ({
  useCommunityProfile: () => ({
    profile: null, loading: false, saveUsername: jest.fn(), pickAvatar: jest.fn(), avatarStatus: 'idle',
  }),
}));

import YouScreen from '../(tabs)/you';

test('returning to Account re-reads the count after flags were edited elsewhere', async () => {
  const { findByText } = await render(<YouScreen />);
  await findByText('None');
  await saveAllergenProfile('u1', toggleGroup(toggleGroup(emptyProfile('yes', 't'), 'fragrance'), 'parabens'));
  await act(async () => mockFocus?.());
  await findByText('2 flagged');
});
