import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import { Alert } from 'react-native';
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
  const alertSpy = jest.spyOn(Alert, 'alert');

  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
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

  afterEach(() => {
    cleanup();
    bag.clear();
  });

  it('renders empty bag when bag is empty', async () => {
    const view = await render(<CheckoutScreen />);
    expect(view.getByText('Your bag is empty')).toBeTruthy();
  });

  it('handles successful Stripe payment flow with shipping address', async () => {
    bag.add({ id: 'lum-tint-01', name: 'Luminous Skin Tint', price: 24, shadeName: '4N' } as any);

    const view = await render(<CheckoutScreen />);

    // Fill shipping address
    await fireEvent.changeText(view.getByTestId('shipping-name'), 'Alex Morgan');
    await fireEvent.changeText(view.getByTestId('shipping-street'), '456 Oak Avenue');
    await fireEvent.changeText(view.getByTestId('shipping-city'), 'Chicago');
    await fireEvent.changeText(view.getByTestId('shipping-state'), 'IL');
    await fireEvent.changeText(view.getByTestId('shipping-zip'), '60601');

    // Tap pay
    const payBtn = view.getByTestId('place-order');
    await fireEvent.press(payBtn);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('create-payment-intent', {
        body: {
          items: expect.arrayContaining([
            expect.objectContaining({ product: expect.objectContaining({ id: 'lum-tint-01' }), qty: 1 }),
          ]),
          shippingAddress: {
            name: 'Alex Morgan',
            street: '456 Oak Avenue',
            city: 'Chicago',
            state: 'IL',
            zip: '60601',
          },
        },
      });
      expect(mockInitPaymentSheet).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantDisplayName: 'TrueTone',
          paymentIntentClientSecret: 'pi_secret',
          customerEphemeralKeySecret: 'ek_secret',
          customerId: 'cus_123',
        })
      );
      expect(mockPresentPaymentSheet).toHaveBeenCalled();
      expect(view.getByText('Order placed')).toBeTruthy();
    });

    expect(bag.getState().lines).toHaveLength(0);
  });

  it('handles user cancellation gracefully without showing error alert', async () => {
    bag.add({ id: 'lum-tint-01', name: 'Luminous Skin Tint', price: 24 } as any);
    mockPresentPaymentSheet.mockResolvedValue({
      error: { code: 'Canceled', message: 'The payment flow was canceled' },
    });

    const view = await render(<CheckoutScreen />);
    const payBtn = view.getByTestId('place-order');
    await fireEvent.press(payBtn);

    await waitFor(() => {
      expect(mockPresentPaymentSheet).toHaveBeenCalled();
    });

    // Alert was not shown, bag was not cleared
    expect(alertSpy).not.toHaveBeenCalled();
    expect(bag.getState().lines).toHaveLength(1);
    expect(view.queryByText('Order placed')).toBeNull();
  });

  it('displays alert on declined card and preserves bag items', async () => {
    bag.add({ id: 'lum-tint-01', name: 'Luminous Skin Tint', price: 24 } as any);
    mockPresentPaymentSheet.mockResolvedValue({
      error: { code: 'Failed', message: 'Your card was declined' },
    });

    const view = await render(<CheckoutScreen />);
    const payBtn = view.getByTestId('place-order');
    await fireEvent.press(payBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Payment Error', 'Your card was declined');
    });

    expect(bag.getState().lines).toHaveLength(1);
    expect(view.queryByText('Order placed')).toBeNull();
  });

  it('displays alert when edge function payment initialization fails', async () => {
    bag.add({ id: 'lum-tint-01', name: 'Luminous Skin Tint', price: 24 } as any);
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'create-payment-intent failed: unauthorized' },
    });

    const view = await render(<CheckoutScreen />);
    const payBtn = view.getByTestId('place-order');
    await fireEvent.press(payBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Payment Error', 'create-payment-intent failed: unauthorized');
    });

    expect(mockPresentPaymentSheet).not.toHaveBeenCalled();
    expect(bag.getState().lines).toHaveLength(1);
  });
});
