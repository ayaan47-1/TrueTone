// app/checkout.tsx
// Expo-router route for the mock checkout SHELL. Thin wrapper (mirrors how (tabs)/shop.tsx
// delegates to a feature component). Lives OUTSIDE the tab navigator as a stack screen, so
// the root Stack's transparent header gives it a back button automatically.
import { CheckoutScreen } from '../src/features/checkout/CheckoutScreen';

export default function Checkout() {
  return <CheckoutScreen />;
}
