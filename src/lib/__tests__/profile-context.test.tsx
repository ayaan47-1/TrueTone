import { act, render, screen, waitFor } from '@testing-library/react-native';
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
let profileResponse: { data: unknown; error: unknown };
let consentReceiptResponse: { data: unknown; error: unknown };

type ReceiptBuilder = {
  eq: () => ReceiptBuilder;
  order: () => ReceiptBuilder;
  limit: () => ReceiptBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
};

function mockProfileRow(row: unknown, error: unknown = null) {
  profileResponse = { data: row, error };
}

function mockConsentReceipt(policyVersion: string | null, error: unknown = null) {
  consentReceiptResponse = {
    data: policyVersion ? { policy_version: policyVersion } : null,
    error,
  };
}

function Probe() {
  const { loading, error, route, userId } = useProfile();
  return <Text>{`${loading}|${error}|${route}|${userId}`}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCameraDemo = false;
  cameraDemoReset();
  profileResponse = { data: null, error: null };
  consentReceiptResponse = { data: { policy_version: '2026-10-06.a1' }, error: null };
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({ eq: () => ({ single: async () => profileResponse }) }),
      };
    }
    const builder: ReceiptBuilder = {
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => consentReceiptResponse,
    };
    return { select: () => builder };
  });
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

test('active consent on an older biometric policy re-prompts once', async () => {
  mockBootstrap.mockResolvedValue('u1');
  mockRegion.mockReturnValue(true);
  mockProfileRow({ is_18_plus: true, consent_active: true });
  mockConsentReceipt('2026-06-15.1');
  await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>
  );
  await waitFor(() => expect(screen.getByText('false|false|consent|u1')).toBeTruthy());
});

test('active consent on the current biometric policy does not re-prompt', async () => {
  mockBootstrap.mockResolvedValue('u1');
  mockRegion.mockReturnValue(true);
  mockProfileRow({ is_18_plus: true, consent_active: true });
  mockConsentReceipt('2026-10-06.a1');
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

test('a retry after a connection error keeps the error up until the reload settles (no flash of a stale gate)', async () => {
  mockRegion.mockReturnValue(true);
  mockBootstrap.mockRejectedValueOnce(new Error('offline'));
  let refresh: () => Promise<void> = async () => {};
  function RetryProbe() {
    const ctx = useProfile();
    refresh = ctx.refresh;
    return <Text>{`${ctx.loading}|${ctx.error}|${ctx.route}`}</Text>;
  }
  await render(
    <ProfileProvider>
      <RetryProbe />
    </ProfileProvider>
  );
  await waitFor(() => expect(screen.getByText('false|true|region-blocked')).toBeTruthy());

  let finish: (uid: string) => void = () => {};
  mockBootstrap.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve; }));
  mockProfileRow({ is_18_plus: true, consent_active: true });
  let pending: Promise<void> = Promise.resolve();
  await act(async () => { pending = refresh(); });
  // In flight: still the error screen, never error=false with the stale initial route.
  expect(screen.getByText('false|true|region-blocked')).toBeTruthy();
  await act(async () => { finish('u1'); await pending; });
  await waitFor(() => expect(screen.getByText('false|false|home')).toBeTruthy());
});
