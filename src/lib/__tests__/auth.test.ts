import { bootstrapSession } from '../auth';

// `mock`-prefixed names are exempt from jest.mock factory hoisting restrictions.
const mockSignInAnonymously = jest
  .fn()
  .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
const mockGetSession = jest.fn().mockResolvedValue({ data: { session: null }, error: null });
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signInAnonymously: () => mockSignInAnonymously(),
    },
    from: () => ({ upsert: (...a: unknown[]) => mockUpsert(...a) }),
  },
}));

test('creates anonymous session when none exists', async () => {
  await bootstrapSession();
  expect(mockSignInAnonymously).toHaveBeenCalled();
});
