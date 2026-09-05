import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CheckoutScreen } from '../CheckoutScreen';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../../../lib/supabase';
import { bag } from '../bag-store';

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
});
