// On iOS 26+ the floating controls (product-sheet Back, home Bag) are Apple's native Liquid
// Glass, not the Quiet Glass fill. Content (the product page body, tiles) stays non-glass.
import { render, within } from '@testing-library/react-native';

jest.mock('../../../components/ui/liquid-glass', () => ({
  hasLiquidGlass: () => true,
  tabBarClearance: () => 64,
}));
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return { GlassView: (props: object) => <View testID="native-glass" {...props} /> };
});

import { ProductDetail } from '../ProductDetail';
import { BagButton } from '../ShopGrid';

test('the product-sheet Back + Share buttons are native interactive glass', async () => {
  const view = await render(
    <ProductDetail productId="ver-velvet-10" onScan={jest.fn()} onAdded={jest.fn()} onClose={jest.fn()} />,
  );
  const glass = within(view.getByRole('button', { name: 'Back' })).getByTestId('native-glass');
  expect(glass.props.isInteractive).toBe(true);
  const share = within(view.getByRole('button', { name: 'Share' })).getByTestId('native-glass');
  expect(share.props.isInteractive).toBe(true);
  // Only the floating controls are glass — not the page content.
  expect(view.getAllByTestId('native-glass')).toHaveLength(2);
});

test('the home Bag button is native interactive glass', async () => {
  const view = await render(<BagButton onPress={jest.fn()} />);
  const glass = within(view.getByRole('button', { name: 'Bag' })).getByTestId('native-glass');
  expect(glass.props.isInteractive).toBe(true);
});
