import { render } from '@testing-library/react-native';
import { ProductArt } from '../ProductArt';
import { catalog } from '../../match/product-catalog';

const product = catalog.find((p) => p.id === 'lum-bright-17')!;

test('draws the product as its shape when no photo is registered', async () => {
  const unregistered = { ...product, id: 'no-photo-id' };
  const view = await render(<ProductArt product={unregistered} height={120} />);
  expect(view.getByTestId('product-art-tube')).toBeTruthy();
  expect(view.queryByTestId('product-photo')).toBeNull();
});

test('shows the bundled catalog photo by default', async () => {
  const view = await render(<ProductArt product={product} height={120} />);
  expect(view.getByTestId('product-photo')).toBeTruthy();
});

test('uses a registered local photo instead of the drawing', async () => {
  const view = await render(<ProductArt product={product} height={120} photo={1} />);
  expect(view.getByTestId('product-photo')).toBeTruthy();
  expect(view.queryByTestId('product-art-tube')).toBeNull();
});

test('is decorative for screen readers but labelled by product name', async () => {
  const view = await render(<ProductArt product={product} height={120} />);
  expect(view.getByLabelText(product.name)).toBeTruthy();
});
