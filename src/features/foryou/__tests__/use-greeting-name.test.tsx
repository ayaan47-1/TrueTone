// The home greets the user by their community username when one exists.
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useGreetingName } from '../use-greeting-name';
import type { CommunityProfileRepository } from '../../identity/community-profile-repository';

jest.mock('../../../lib/supabase', () => ({ DEMO_MODE: true, CAMERA_DEMO: false, supabase: {} }));

function repo(username: string | null): CommunityProfileRepository {
  return {
    load: jest.fn(async (userId: string) => (username ? { userId, username, avatarUri: null } : null)),
    save: jest.fn(),
  };
}

function Probe({ userId, r }: { userId: string | null; r: CommunityProfileRepository }) {
  return <Text>{useGreetingName(userId, r) ?? 'none'}</Text>;
}

test('loads the username and capitalises it', async () => {
  const view = await render(<Probe userId="u1" r={repo('ayaan')} />);
  await waitFor(() => expect(view.getByText('Ayaan')).toBeTruthy());
});

test('no user or no profile -> undefined', async () => {
  const r = repo(null);
  const view = await render(<Probe userId={null} r={r} />);
  expect(view.getByText('none')).toBeTruthy();
  expect(r.load).not.toHaveBeenCalled();
});

test('a failed load leaves the neutral greeting', async () => {
  const r: CommunityProfileRepository = { load: jest.fn(async () => { throw new Error('offline'); }), save: jest.fn() };
  const view = await render(<Probe userId="u1" r={r} />);
  await waitFor(() => expect(r.load).toHaveBeenCalled());
  expect(view.getByText('none')).toBeTruthy();
});
