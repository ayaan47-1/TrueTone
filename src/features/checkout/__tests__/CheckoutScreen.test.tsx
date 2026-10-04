import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { CheckoutScreen } from '../CheckoutScreen';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../../../lib/supabase';
import { bag } from '../bag-store';
import { orderHistory } from '../order-history-store';

jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: jest.fn(),
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

describe('CheckoutScreen', () => {
  const mockInitPaymentSheet = jest.fn();
  const mockPresentPaymentSheet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    bag.clear();
    orderHistory.clear();
    (useStripe as jest.Mock).mockReturnValue({
      initPaymentSheet: mockInitPaymentSheet,
      presentPaymentSheet: mockPresentPaymentSheet,
    });
    mockInitPaymentSheet.mockResolvedValue({ error: undefined });
    mockPresentPaymentSheet.mockResolvedValue({ error: undefined });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: {
        paymentIntent: 'pi_secret',
        ephemeralKey: 'ek_secret',
        customer: 'cus_123',
      },
      error: null,
    });
  });

  it('renders empty bag', async () => {
    const view = await render(<CheckoutScreen />);
    expect(view.getByText('Your bag is empty')).toBeTruthy();
  });

  it('handles Stripe payment flow', async () => {
    // Add item to bag
    bag.add({ id: 'prod1', name: 'Test Product', price: 10, shadeName: 'Shade 1' } as any);

    const view = await render(<CheckoutScreen />);
    
    // Tap pay
    const payBtn = view.getByTestId('place-order');
    fireEvent.press(payBtn);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('create-payment-intent', expect.any(Object));
      expect(mockInitPaymentSheet).toHaveBeenCalled();
      expect(mockPresentPaymentSheet).toHaveBeenCalled();
    });
    
    // Should show confirmation
    expect(view.getByText('Order placed')).toBeTruthy();
  });

  it('records the purchased products in on-device order history (for routine suggestions)', async () => {
    bag.add({ id: 'prod1', name: 'Test Product', price: 10 } as any);
    const view = await render(<CheckoutScreen />);
    fireEvent.press(view.getByTestId('place-order'));
    await waitFor(() => expect(view.getByText('Order placed')).toBeTruthy());
    expect(orderHistory.purchasedIds()).toEqual(['prod1']);
  });

  it('does not record anything when the payment sheet is canceled', async () => {
    mockPresentPaymentSheet.mockResolvedValue({ error: { code: 'Canceled', message: 'x' } });
    bag.add({ id: 'prod1', name: 'Test Product', price: 10 } as any);
    const view = await render(<CheckoutScreen />);
    fireEvent.press(view.getByTestId('place-order'));
    await waitFor(() => expect(mockPresentPaymentSheet).toHaveBeenCalled());
    expect(orderHistory.purchasedIds()).toEqual([]);
  });

  it('a double tap on Pay starts only one payment', async () => {
    bag.add({ id: 'prod1', name: 'Test Product', price: 10 } as any);
    const view = await render(<CheckoutScreen />);
    const pay = view.getByTestId('place-order');
    // Two taps in the same frame, before React re-renders with loading=true. Both go through
    // one act() (Pressable's onClick runs onPress) so no act scope leaks into later tests.
    await act(async () => {
      pay.props.onClick({ nativeEvent: {} });
      pay.props.onClick({ nativeEvent: {} });
    });
    await waitFor(() => expect(view.getByText('Order placed')).toBeTruthy());
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it('the summary lists each shade of the same product as its own row, with the chosen shade', async () => {
    const p = { id: 'prod1', name: 'Test Product', price: 10, shadeName: 'Default 1' } as any;
    bag.add(p, 1, 'Honey 5W');
    bag.add(p, 2, 'Amber 7W');
    const view = await render(<CheckoutScreen />);
    expect(view.getByText(/Honey 5W/)).toBeTruthy();
    expect(view.getByText(/Amber 7W/)).toBeTruthy();
    expect(view.queryByText(/Default 1/)).toBeNull();
  });
});
