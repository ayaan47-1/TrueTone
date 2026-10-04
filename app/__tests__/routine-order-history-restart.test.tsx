// Order history must survive an app restart: a fresh JS context (this test file loads the store
// for the first time) reads what an earlier session wrote to on-device storage, and the routine
// picker's "From your orders" group shows it.
import { render, screen, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { catalog } from '../../src/features/match/product-catalog';
import { ORDER_HISTORY_KEY } from '../../src/features/checkout/order-history-store';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('../../src/lib/scans', () => ({
  fetchScanHistory: () => Promise.resolve([]),
}));
jest.mock('../../src/lib/supabase', () => ({ DEMO_MODE: true }));
jest.mock('../../src/lib/profile-context', () => ({
  useProfile: () => ({ userId: 'u1' }),
}));

import RoutineRoute from '../routine';

const bought = catalog[2];

test('previously purchased items still appear in the routine picker after a restart', async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify([bought.id]));
  await render(<RoutineRoute />);
  await fireEvent.press(await screen.findByTestId('routine-add-am'));
  expect(await screen.findByText('From your orders')).toBeTruthy();
  expect(screen.getByTestId(`routine-pick-${bought.id}`)).toBeTruthy();
});
