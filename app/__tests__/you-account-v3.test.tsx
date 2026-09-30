import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('../../src/lib/scans', () => ({
  fetchScanHistory: jest.fn(() => Promise.resolve([{ id: '1' }, { id: '2' }, { id: '3' }])),
}));
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => ({ userId: 'test-user', loading: false, error: false, route: 'home', refresh: jest.fn() }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../src/features/identity/use-community-profile', () => ({
  useCommunityProfile: () => ({
    profile: { userId: 'test-user', username: 'ada', avatarUri: null },
    loading: false,
    saveUsername: jest.fn().mockResolvedValue({ ok: true }),
    pickAvatar: jest.fn(),
    avatarStatus: 'idle',
  }),
}));

import YouScreen from '../(tabs)/you';
import { personalization } from '../../src/features/session/personalization';
import { shelfStore } from '../../src/features/shop/shelf-store';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  personalization.reset();
  shelfStore.get().forEach((id) => shelfStore.remove(id));
});

describe('Account tab (v3 video t-15/t-17)', () => {
  it('shows the Account header with a notifications bell', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await render(<YouScreen />);
    expect(view.getByText('Account')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Notifications' }));
    await flush();
    expect(alert).toHaveBeenCalled();
    await flush();
  });

  it('renders the profile card: initial avatar, name, handle and shade chip', async () => {
    const view = await render(<YouScreen />);
    expect(view.getByText('ada')).toBeTruthy();
    expect(view.getByText('A', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByText('ada')).toBeTruthy();
    expect(view.getByText('@ada')).toBeTruthy();
    expect(view.getByText('No shade yet')).toBeTruthy();
    await flush();
  });

  it('shows the current shade name on the chip after a scan and hides "Find my shade"', async () => {
    personalization.setScan({ shadeName: 'Warm Sand', undertone: 'warm', depth: 'medium', finish: 'natural' } as never);
    const view = await render(<YouScreen />);
    expect(view.getByText('Warm Sand')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Find my shade' })).toBeNull();
    await flush();
  });

  it('offers "Find my shade" before a scan, routing to the scan gate (never the camera)', async () => {
    const view = await render(<YouScreen />);
    fireEvent.press(view.getByRole('button', { name: 'Find my shade' }));
    await flush();
    expect(mockPush).toHaveBeenCalledWith('/scan-gate');
    expect(mockPush).not.toHaveBeenCalledWith('/scan');
    await flush();
  });

  it('shows the Orders / Saved / Day streak stats from state', async () => {
    shelfStore.add('p1');
    const view = await render(<YouScreen />);
    expect(view.getAllByText('Orders')).toHaveLength(2); // stat label + Shopping row
    expect(view.getByText('Saved')).toBeTruthy();
    expect(view.getByText('Day streak')).toBeTruthy();
    expect(view.getByText('1 product')).toBeTruthy();
    await flush();
  });

  it('lists the Shopping and Your shade sections with their captions and routes', async () => {
    const view = await render(<YouScreen />);
    await flush();
    expect(view.getByText('Shopping')).toBeTruthy();
    expect(view.getByText('Your shade')).toBeTruthy();
    expect(view.getByText('No orders yet')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Addresses & payment' })).toBeTruthy();
    expect(view.getByText('Coverage, finish, things you skip')).toBeTruthy();
    expect(view.getByText('3 of 5 scans logged')).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Saved items' }));

    await flush();
    expect(mockPush).toHaveBeenCalledWith('/shop');
    fireEvent.press(view.getByRole('button', { name: 'Shade & preferences' }));
    await flush();
    expect(mockPush).toHaveBeenCalledWith('/setup/goals');
  });

  it('keeps the username editor behind Edit', async () => {
    const view = await render(<YouScreen />);
    expect(view.queryByTestId('username-input')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Edit profile' }));
    await flush();
    expect(view.getByTestId('username-input')).toBeTruthy();
    await flush();
  });

  it('keeps data rights, policies and delete reachable below the new sections', async () => {
    const view = await render(<YouScreen />);
    fireEvent.press(view.getByRole('button', { name: 'Your Data' }));
    await flush();
    expect(mockPush).toHaveBeenCalledWith('/data');
    fireEvent.press(view.getByRole('button', { name: 'Privacy & Policies' }));
    await flush();
    expect(mockPush).toHaveBeenCalledWith('/policies');
    expect(view.getByRole('button', { name: 'Delete everything' })).toBeTruthy();
    expect(view.getByText(/not a medical device/i)).toBeTruthy();
    await flush();
  });
});
