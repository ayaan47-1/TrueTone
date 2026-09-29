// Shop tab + product route wiring: tiles open /product/<id>, the bag button opens the bag,
// the product page adds to the bag and closes. Route files stay thin wrappers.
import { render, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({ id: 'ver-velvet-10' }),
}));

import ShopScreen from '../(tabs)/shop';
import ProductRoute from '../product/[id]';
import { bag } from '../../src/features/checkout/bag-store';

beforeEach(() => {
  jest.clearAllMocks();
  bag.clear();
});

test('shop tab: tile opens the product page, scan prompt opens the scan gate', async () => {
  const view = await render(<ShopScreen />);
  await fireEvent.press(view.getByTestId('product-ver-velvet-10'));
  expect(mockPush).toHaveBeenCalledWith('/product/ver-velvet-10');
  await fireEvent.press(view.getByRole('button', { name: 'See your fit on every product' }));
  expect(mockPush).toHaveBeenCalledWith('/scan-gate');
  await fireEvent.press(view.getByRole('button', { name: 'Bag' }));
  expect(mockPush).toHaveBeenCalledWith('/bag');
});

test('product route: adding closes the sheet', async () => {
  const view = await render(<ProductRoute />);
  await fireEvent.press(view.getByRole('button', { name: 'Add to bag · $33' }));
  expect(bag.getState().lines).toHaveLength(1);
  expect(mockBack).toHaveBeenCalled();
});
