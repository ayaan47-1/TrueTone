import { bootstrapSession } from '../auth';

// `mock`-prefixed names are exempt from jest.mock factory hoisting restrictions.
const mockSignInAnonymously = jest
  .fn()
  .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
const mockGetSession = jest.fn().mockResolvedValue({ data: { session: null }, error: null });
const mockRpc = jest.fn().mockResolvedValue({ error: null });
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signInAnonymously: () => mockSignInAnonymously(),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockSignInAnonymously.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  mockRpc.mockResolvedValue({ error: null });
});

test('creates anonymous session when none exists', async () => {
  await expect(bootstrapSession()).resolves.toBe('u1');
  expect(mockSignInAnonymously).toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledWith('ensure_profile');
});

test('ensures the existing authenticated user profile through the self-scoped RPC', async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u2' } } }, error: null });

  await expect(bootstrapSession()).resolves.toBe('u2');

  expect(mockSignInAnonymously).not.toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledWith('ensure_profile');
});

test('fails closed when the profile RPC fails', async () => {
  mockRpc.mockResolvedValueOnce({ error: { message: 'denied' } });

  await expect(bootstrapSession()).rejects.toThrow('profile-bootstrap-failed');
});
