// v3 bag: lines per product + shade, qty stepper, remove, "Finish your look", subtotal,
// checkout CTA. No promo code, no discount, no invented shipping rules.
import { render, fireEvent } from '@testing-library/react-native';
import { BagScreen } from '../BagScreen';
import { bag, lineKey } from '../bag-store';
import { catalog } from '../../match/product-catalog';

const [a, b] = catalog;
const handlers = () => ({ onShop: jest.fn(), onCheckout: jest.fn(), onBack: jest.fn() });

beforeEach(() => bag.clear());

test('empty bag: calm empty state that routes back to the shop', async () => {
  const h = handlers();
  const view = await render(<BagScreen {...h} />);
  expect(view.getByText('Your bag is empty')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Start shopping' }));
  expect(h.onShop).toHaveBeenCalled();
});

test('lines show shade, qty changes update the total, trash removes', async () => {
  bag.add(a, 1, 'Honey 5W');
  bag.add(b, 2);
  const h = handlers();
  const view = await render(<BagScreen {...h} />);
  expect(view.getByText('Honey 5W')).toBeTruthy();
  expect(view.getByText('3 items')).toBeTruthy();
  const total = a.price + b.price * 2;
  expect(view.getByRole('button', { name: `Checkout · $${total}` })).toBeTruthy();

  await fireEvent.press(view.getAllByRole('button', { name: 'Increase quantity' })[0]);
  expect(bag.getState().lines.find((l) => lineKey(l) === lineKey({ product: a, shade: 'Honey 5W' }))?.qty).toBe(2);

  await fireEvent.press(view.getByRole('button', { name: `Remove ${b.name}` }));
  expect(bag.getState().lines).toHaveLength(1);

  await fireEvent.press(view.getByRole('button', { name: `Checkout · $${a.price * 2}` }));
  expect(h.onCheckout).toHaveBeenCalled();
  expect(view.queryAllByText(/promo|discount|%|TRUE15/i)).toHaveLength(0);
});

test('"Finish your look" suggests items not in the bag and adds them', async () => {
  bag.add(a);
  const view = await render(<BagScreen {...handlers()} />);
  expect(view.getByText('Finish your look')).toBeTruthy();
  const addButtons = view.getAllByRole('button', { name: /^Add .+ to bag$/ });
  expect(addButtons.length).toBeGreaterThan(0);
  await fireEvent.press(addButtons[0]);
  expect(bag.getState().lines).toHaveLength(2);
});
