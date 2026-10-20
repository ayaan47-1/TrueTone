import { render } from '@testing-library/react-native';
import { CheckoutScreen } from '../CheckoutScreen';
import { supabase } from '../../../lib/supabase';

// Camera build (Dwight FAIL on PR #60): checkout must not create a PaymentIntent or reach Stripe.
jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: () => ({ initPaymentSheet: jest.fn(), presentPaymentSheet: jest.fn() }),
}));
jest.mock('../../../lib/supabase', () => ({
  SUPABASE_OFFLINE: true,
  supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));

test('camera build shows a local-only notice and never invokes create-payment-intent', async () => {
  const { getByText, queryByText } = await render(<CheckoutScreen />);
  expect(getByText('Checkout is off in this test build')).toBeTruthy();
  expect(queryByText(/Place order/i)).toBeNull();
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
