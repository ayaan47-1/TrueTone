import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ProfileProvider, useProfile } from '../profile-context';
import { bootstrapSession } from '../auth';
import { isUSRegion } from '../region';
import { supabase } from '../supabase';
import { cameraDemoReset, cameraDemoSetIs18, cameraDemoSetConsent } from '../camera-demo-profile';

jest.mock('../auth', () => ({ bootstrapSession: jest.fn() }));
jest.mock('../region', () => ({ isUSRegion: jest.fn() }));
let mockCameraDemo = false;
jest.mock('../supabase', () => ({
  supabase: { from: jest.fn() },
  DEMO_MODE: false,
  get CAMERA_DEMO() {
    return mockCameraDemo;
  },
}));

const mockBootstrap = bootstrapSession as jest.Mock;
const mockRegion = isUSRegion as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

function mockProfileRow(row: unknown, error: unknown = null) {
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ single: async () => ({ data: row, error }) }) }),
  });
}

function Probe() {
  const { loading, error, route, userId } = useProfile();
  return <Text>{`${loading}|${error}|${route}|${userId}`}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCameraDemo = false;
  cameraDemoReset();
});

test('happy path: US + 18+ + consent -> home, exposes userId', async () => {
  mockBootstrap.mockResolvedValue('u1');
  mockRegion.mockReturnValue(true);
  mockProfileRow({ is_18_plus: true, consent_active: true });
  await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>
  );
  await waitFor(() => expect(screen.getByText('false|false|home|u1')).toBeTruthy());
});

test('not 18+ -> age-gate', async () => {
  mockBootstrap.mockResolvedValue('u1');
  mockRegion.mockReturnValue(true);
  mockProfileRow({ is_18_plus: false, consent_active: false });
  await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>
  );
  await waitFor(() => expect(screen.getByText('false|false|age-gate|u1')).toBeTruthy());
});

test('18+ but no consent -> consent', async () => {
  mockBootstrap.mockResolvedValue('u1');
  mockRegion.mockReturnValue(true);
  mockProfileRow({ is_18_plus: true, consent_active: false });
  await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>
  );
  await waitFor(() => expect(screen.getByText('false|false|consent|u1')).toBeTruthy());
});

test('non-US -> region-blocked', async () => {
  mockBootstrap.mockResolvedValue('u1');
  mockRegion.mockReturnValue(false);
  mockProfileRow({ is_18_plus: true, consent_active: true });
  await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>
  );
  await waitFor(() => expect(screen.getByText('false|false|region-blocked|u1')).toBeTruthy());
});

test('fails closed on bootstrap error (never advances)', async () => {
  mockBootstrap.mockRejectedValue(new Error('auth-bootstrap-failed'));
  await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>
  );
  // error true, route stays at the safe default, userId null
  await waitFor(() => expect(screen.getByText('false|true|region-blocked|null')).toBeTruthy());
});

test('fails closed on profile-load error', async () => {
  mockBootstrap.mockResolvedValue('u1');
  mockRegion.mockReturnValue(true);
  mockProfileRow(null, { message: 'boom' });
  await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>
  );
  await waitFor(() => expect(screen.getByText(/\|true\|/)).toBeTruthy());
});

test('useProfile throws outside a provider', async () => {
  await expect(render(<Probe />)).rejects.toThrow(/useProfile outside provider/);
});

describe('CAMERA_DEMO', () => {
  beforeEach(() => {
    mockCameraDemo = true;
  });

  test('never touches the real backend', async () => {
    await render(
      <ProfileProvider>
        <Probe />
      </ProfileProvider>
    );
    expect(mockBootstrap).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('neither gate flag pre-cleared -> age-gate first, NOT home (Dwight condition (b))', async () => {
    await render(
      <ProfileProvider>
        <Probe />
      </ProfileProvider>
    );
    await waitFor(() => expect(screen.getByText(/\|age-gate\|/)).toBeTruthy());
  });

  test('after a real 18+ pass but before consent -> consent, still not home', async () => {
    cameraDemoSetIs18();
    await render(
      <ProfileProvider>
        <Probe />
      </ProfileProvider>
    );
    await waitFor(() => expect(screen.getByText(/\|consent\|/)).toBeTruthy());
  });

  test('after both real taps -> home', async () => {
    cameraDemoSetIs18();
    cameraDemoSetConsent();
    await render(
      <ProfileProvider>
        <Probe />
      </ProfileProvider>
    );
    await waitFor(() => expect(screen.getByText(/\|home\|/)).toBeTruthy());
  });
});
