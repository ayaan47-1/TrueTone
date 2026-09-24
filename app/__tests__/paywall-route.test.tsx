import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { setEntitlementSource, localStubEntitlement } from '../../src/features/premium/entitlement';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

import PaywallScreen from '../paywall';

describe('PaywallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setEntitlementSource(localStubEntitlement(false));
  });

  test('renders both plan prices and the free-trial CTA', async () => {
    const view = await render(<PaywallScreen />);
    expect(view.getByText('$39.99/yr')).toBeTruthy();
    expect(view.getByText('$8.99/mo')).toBeTruthy();
    expect(view.getByText('Start free trial')).toBeTruthy();
    expect(view.getByText('Restore purchases')).toBeTruthy();
    expect(view.getByText('Maybe later')).toBeTruthy();
  });

  test('subscribing navigates to scan-gate upon successful entitlement', async () => {
    const view = await render(<PaywallScreen />);
    const cta = view.getByTestId('paywall-subscribe');
    fireEvent.press(cta);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/scan-gate');
    });
  });

  test('maybe later navigates directly to scan-gate without subscribing', async () => {
    const view = await render(<PaywallScreen />);
    const maybeLater = view.getByTestId('paywall-maybe-later');
    fireEvent.press(maybeLater);

    expect(mockPush).toHaveBeenCalledWith('/scan-gate');
  });
});
