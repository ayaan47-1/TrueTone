import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { CheckoutScreen, orderReference } from '../CheckoutScreen';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../../../lib/supabase';
import { encryptedStorage } from '../../../lib/encrypted-storage';
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

// The checkout unit test exercises order-history behavior, not the device crypto adapter.
jest.mock('../../../lib/encrypted-storage', () => ({
  encryptedStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

describe('CheckoutScreen', () => {
  const mockInitPaymentSheet = jest.fn();
  const mockPresentPaymentSheet = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    bag.clear();
    await orderHistory.clear();
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

  async function fillValidShippingAddress(view: Awaited<ReturnType<typeof render>>) {
    const values = [
      ['shipping-full-name', '  Jordan Rivera  '],
      ['shipping-line1', '  123 Maple Street  '],
      ['shipping-line2', ''],
      ['shipping-city', '  Chicago  '],
      ['shipping-state', 'il'],
      ['shipping-postal-code', '60601'],
      ['shipping-country', 'us'],
    ] as const;
    for (const [testID, value] of values) {
      const field = view.getByTestId(testID);
      await fireEvent.changeText(field, value);
      await fireEvent(field, 'blur');
    }
  }

  it('renders empty bag', async () => {
    const view = await render(<CheckoutScreen />);
    expect(view.getByText('Your bag is empty')).toBeTruthy();
  });

  it('handles Stripe payment flow', async () => {
    // Add item to bag
    bag.add({ id: 'prod1', name: 'Test Product', price: 10, shadeName: 'Shade 1' } as any);

    const view = await render(<CheckoutScreen />);
    await fillValidShippingAddress(view);

    // Tap pay
    const payBtn = view.getByTestId('place-order');
    await fireEvent.press(payBtn);

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
    await fillValidShippingAddress(view);
    await fireEvent.press(view.getByTestId('place-order'));
    await waitFor(() => expect(view.getByText('Order placed')).toBeTruthy());
    expect(orderHistory.purchasedIds()).toEqual(['prod1']);
  });

  it('does not record anything when the payment sheet is canceled', async () => {
    mockPresentPaymentSheet.mockResolvedValue({ error: { code: 'Canceled', message: 'x' } });
    bag.add({ id: 'prod1', name: 'Test Product', price: 10 } as any);
    const view = await render(<CheckoutScreen />);
    await fillValidShippingAddress(view);
    await fireEvent.press(view.getByTestId('place-order'));
    await waitFor(() => expect(mockPresentPaymentSheet).toHaveBeenCalled());
    expect(orderHistory.purchasedIds()).toEqual([]);
  });

  it('a double tap on Pay starts only one payment', async () => {
    bag.add({ id: 'prod1', name: 'Test Product', price: 10 } as any);
    const view = await render(<CheckoutScreen />);
    await fillValidShippingAddress(view);
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

  it('keeps Pay disabled until every required shipping field is valid', async () => {
    bag.add({ id: 'prod1', name: 'Test Product', price: 10 } as any);
    const view = await render(<CheckoutScreen />);

    expect(view.getByTestId('place-order')).toBeDisabled();
    await fillValidShippingAddress(view);
    expect(view.getByTestId('place-order')).not.toBeDisabled();

    await fireEvent.changeText(view.getByTestId('shipping-postal-code'), '606');
    await fireEvent(view.getByTestId('shipping-postal-code'), 'blur');
    expect(view.getByText('Enter a valid ZIP code.')).toBeTruthy();
    expect(view.getByTestId('place-order')).toBeDisabled();
  });

  it('sends the normalized shipping address with the order without storing it locally', async () => {
    bag.add({ id: 'prod1', name: 'Test Product', price: 10 } as any);
    const view = await render(<CheckoutScreen />);
    await fillValidShippingAddress(view);
    await fireEvent.changeText(view.getByTestId('shipping-line2'), '  Apt 4B  ');

    await fireEvent.press(view.getByTestId('place-order'));

    await waitFor(() =>
      expect(supabase.functions.invoke).toHaveBeenCalledWith('create-payment-intent', {
        body: {
          items: expect.any(Array),
          shippingAddress: {
            name: 'Jordan Rivera',
            line1: '123 Maple Street',
            line2: 'Apt 4B',
            city: 'Chicago',
            state: 'IL',
            postalCode: '60601',
            country: 'US',
          },
        },
      }),
    );
    await waitFor(() => expect(encryptedStorage.setItem).toHaveBeenCalled());
    expect(JSON.stringify((encryptedStorage.setItem as jest.Mock).mock.calls)).not.toContain(
      'Jordan Rivera',
    );
  });

// MASVS L5: the confirmation shows a reference to the real server order, never a random number.
describe('order reference (MASVS L5)', () => {
  async function placeWith(data: Record<string, unknown>) {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { paymentIntent: 'pi_secret', ephemeralKey: 'ek_secret', customer: 'cus_123', ...data },
      error: null,
    });
    bag.add({ id: 'prod1', name: 'Test Product', price: 10, shadeName: 'Shade 1' } as any);
    const view = await render(<CheckoutScreen />);
    await fillValidShippingAddress(view);
    await fireEvent.press(view.getByTestId('place-order'));
    await waitFor(() => expect(view.getByText('Order placed')).toBeTruthy());
    return view;
  }

  it('shows the server order id as the order reference', async () => {
    const random = jest.spyOn(Math, 'random');
    const view = await placeWith({ orderId: 'a1b2c3d4-0000-4000-8000-000000000001' });
    // The full server id (the orders primary key), so the reference is unique by construction.
    expect(view.getByTestId('order-number').props.children).toBe('TT-A1B2C3D4-0000-4000-8000-000000000001');
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it('shows no made-up number when the server sent no order id', async () => {
    const view = await placeWith({});
    expect(view.queryByTestId('order-number')).toBeNull();
  });
});
});

// Toby round-2 MEDIUM: an 8-hex prefix is a 32-bit space and can name two orders.
describe('orderReference', () => {
  it('gives two orders that share an 8-hex prefix different references', () => {
    const a = orderReference('a1b2c3d4-0000-4000-8000-000000000001');
    const b = orderReference('a1b2c3d4-ffff-4fff-bfff-ffffffffffff');
    expect(a).not.toBeNull();
    expect(a).not.toBe(b);
  });

  it('maps back to exactly one server id (case-insensitive)', () => {
    const id = 'a1b2c3d4-0000-4000-8000-000000000001';
    expect(orderReference(id)?.replace(/^TT-/, '').toLowerCase()).toBe(id);
  });

  it('returns null for anything that is not a full uuid', () => {
    for (const bad of ['a1b2c3d4-', 'a1b2c3d4-0000', 'not-a-uuid', 42, null, undefined]) {
      expect(orderReference(bad)).toBeNull();
    }
  });
});
