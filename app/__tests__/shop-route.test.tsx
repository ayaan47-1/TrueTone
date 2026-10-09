// Shopify Shop routes are isolated from the existing local recommendation/product flow.
import { render, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
let mockParams: Record<string, string> = { id: 'ver-velvet-10' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => mockCanGoBack }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('../../src/features/commerce/shopify/ui/ShopifyShopScreen', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    ShopifyShopScreen: ({
      onOpen,
      onBag,
      onDecline,
    }: {
      onOpen: (handle: string) => void;
      onBag: () => void;
      onDecline: () => void;
    }) => (
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Shopify product" onPress={() => onOpen('yensa-bronzing-drops')}>
          <Text>Open Shopify product</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Shopify bag" onPress={onBag}>
          <Text>Open Shopify bag</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Decline Shopify Shop" onPress={onDecline}>
          <Text>Decline Shopify Shop</Text>
        </Pressable>
      </View>
    ),
  };
});

import ShopScreen from '../(tabs)/shop';
import ProductRoute from '../product/[id]';
import BagRoute from '../bag';
import { catalog } from '../../src/features/match/product-catalog';
import { bag } from '../../src/features/checkout/bag-store';
import { computeOrderTotalCents, formatCents } from '../../src/features/checkout/pricing';

beforeEach(() => {
  jest.clearAllMocks();
  bag.clear();
  mockCanGoBack = true;
  mockParams = { id: 'ver-velvet-10' };
});

test('Shopify shop opens its isolated product and bag routes', async () => {
  const view = await render(<ShopScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Open Shopify product' }));
  expect(mockPush).toHaveBeenCalledWith('/shop-product/yensa-bronzing-drops');
  await fireEvent.press(view.getByRole('button', { name: 'Open Shopify bag' }));
  expect(mockPush).toHaveBeenCalledWith('/shop-bag');
});

test('Shopify shop decline returns to Home', async () => {
  const view = await render(<ShopScreen />);
  await fireEvent.press(view.getByRole('button', { name: 'Decline Shopify Shop' }));
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('product route: the back button closes the sheet', async () => {
  const view = await render(<ProductRoute />);
  await fireEvent.press(view.getByRole('button', { name: 'Back' }));
  expect(mockBack).toHaveBeenCalled();
  expect(bag.getState().lines).toHaveLength(0);
});

test('product route: adding closes the sheet', async () => {
  const view = await render(<ProductRoute />);
  await fireEvent.press(view.getByRole('button', { name: 'Add to bag · $33' }));
  expect(bag.getState().lines).toHaveLength(1);
  expect(mockBack).toHaveBeenCalled();
});

test('bag route: empty state goes to the shop tab; checkout goes to /checkout', async () => {
  const view = await render(<BagRoute />);
  await fireEvent.press(view.getByRole('button', { name: 'Start shopping' }));
  expect(mockPush).toHaveBeenCalledWith('/shop');
  bag.add(catalog[0]);
  const full = await render(<BagRoute />);
  await fireEvent.press(full.getByRole('button', { name: `Checkout · ${formatCents(computeOrderTotalCents(bag.getState().lines))}` }));
  expect(mockPush).toHaveBeenCalledWith('/checkout');
});

test('product route opened cold (no history) falls back to the shop tab', async () => {
  mockCanGoBack = false;
  const view = await render(<ProductRoute />);
  await fireEvent.press(view.getByRole('button', { name: 'Add to bag · $33' }));
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/shop');
});
