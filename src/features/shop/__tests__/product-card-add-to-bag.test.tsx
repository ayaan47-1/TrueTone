// src/features/shop/__tests__/product-card-add-to-bag.test.tsx
// Closes the shop -> bag -> checkout reachability gap: tapping "Add to bag" on a
// ProductCard must call bag.add() and make BagBar reflect the new count. Renders
// are ASYNC (repo gotcha a): await render, query via `view`.
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

// BagBar routes to /checkout via useRouter -- mock expo-router the same way
// src/features/onboarding/__tests__/Onboarding.test.tsx does, since the real
// module pulls in an ESM dependency (standard-navigation) Jest can't parse.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import { ProductCard } from '../ProductCard';
import { BagBar } from '../../checkout/BagBar';
import { bag } from '../../checkout/bag-store';
import { catalog } from '../../match/product-catalog';

const product = catalog[0];

function Harness() {
  return (
    <View>
      <BagBar />
      <ProductCard product={product} />
    </View>
  );
}

describe('ProductCard add-to-bag', () => {
  // Only reset before each test: bag is a module-level singleton scoped to this
  // test file's own module registry (Jest sandboxes each test file), so nothing
  // leaks to other files. Resetting after, once no component is mounted to receive
  // the notification, produced a "not wrapped in act()" warning.
  beforeEach(() => bag.clear());

  test('BagBar is absent while the bag is empty', async () => {
    const view = await render(<Harness />);
    expect(view.queryByTestId('bag-bar')).toBeNull();
  });

  test('tapping Add to bag calls bag.add and BagBar appears with the right count', async () => {
    const view = await render(<Harness />);

    fireEvent.press(view.getByTestId(`add-to-bag-${product.id}`));

    expect(bag.getState().lines).toEqual([{ product, qty: 1 }]);
    await waitFor(() => expect(view.getByTestId('bag-bar')).toBeTruthy());
    expect(view.getByText(`1 item · $${product.price}`)).toBeTruthy();
  });

  test('tapping twice bumps the qty and subtotal', async () => {
    const view = await render(<Harness />);

    fireEvent.press(view.getByTestId(`add-to-bag-${product.id}`));
    fireEvent.press(view.getByTestId(`add-to-bag-${product.id}`));

    expect(bag.getState().lines).toEqual([{ product, qty: 2 }]);
    await waitFor(() =>
      expect(view.getByText(`2 items · $${product.price * 2}`)).toBeTruthy(),
    );
  });
});
