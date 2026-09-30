// v3 bag promo (frame t-08): TRUE15 field with an Applied state, Subtotal / Discount (15%) /
// Shipping / Total lines, a Checkout CTA that tracks the total, and Dwight's demo label.
import { render, fireEvent } from '@testing-library/react-native';
import { BagScreen } from '../BagScreen';
import { bag } from '../bag-store';
import { catalog } from '../../match/product-catalog';
import type { Product } from '../../match/match-types';
import { within } from '@testing-library/react-native';
import { DEMO_PROMO_LABEL, DEMO_TOTALS_LABEL, SAMPLE_CATALOG_LABEL } from '../../shop/sample-content';

const handlers = () => ({ onShop: jest.fn(), onCheckout: jest.fn(), onBack: jest.fn() });
const flush = () => new Promise((r) => setTimeout(r, 0));
// A $42 product, as in the frame, so the numbers match t-08 exactly.
const p42: Product = { ...catalog[0], id: 'test-42', price: 42 };

beforeEach(() => bag.clear());

test('before a code: subtotal, shipping with the free-shipping gap, total, demo label', async () => {
  bag.add(p42);
  const view = await render(<BagScreen {...handlers()} />);
  expect(view.getByText('Subtotal')).toBeTruthy();
  expect(view.getByText('$42.00')).toBeTruthy();
  expect(view.getByText('Shipping')).toBeTruthy();
  expect(view.getByText('$5.00')).toBeTruthy();
  expect(view.getByText('Add $8.00 more for free shipping')).toBeTruthy();
  expect(view.getByText('$47.00')).toBeTruthy();
  expect(view.queryByText('Discount (15%)')).toBeNull();
  expect(view.getByText(DEMO_PROMO_LABEL)).toBeTruthy();
  expect(view.getByRole('button', { name: 'Checkout · $47.00' })).toBeTruthy();
});

test('TRUE15 applies 15% off: Applied state, discount line, total and CTA update', async () => {
  bag.add(p42);
  const view = await render(<BagScreen {...handlers()} />);
  await fireEvent.changeText(view.getByLabelText('Promo code'), 'true15');
  await flush();
  await fireEvent.press(view.getByRole('button', { name: 'Apply promo code' }));
  await flush();
  expect(view.getByText('Applied')).toBeTruthy();
  expect(view.getByText('Discount (15%)')).toBeTruthy();
  expect(view.getByText('−$6.30')).toBeTruthy();
  expect(view.getByText('$40.70')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Checkout · $40.70' })).toBeTruthy();
});

test('an unknown code is not applied and says so', async () => {
  bag.add(p42);
  const view = await render(<BagScreen {...handlers()} />);
  await fireEvent.changeText(view.getByLabelText('Promo code'), 'SAVE50');
  await flush();
  await fireEvent.press(view.getByRole('button', { name: 'Apply promo code' }));
  await flush();
  expect(view.getByText('That code isn’t valid.')).toBeTruthy();
  expect(view.queryByText('Discount (15%)')).toBeNull();
  expect(view.getByRole('button', { name: 'Checkout · $47.00' })).toBeTruthy();
});

test('free shipping at $50 and over: shipping reads Free, no gap line', async () => {
  bag.add({ ...p42, id: 'test-60', price: 60 });
  const view = await render(<BagScreen {...handlers()} />);
  expect(view.getByText('Free')).toBeTruthy();
  expect(view.queryByText(/more for free shipping/)).toBeNull();
  expect(view.getByRole('button', { name: 'Checkout · $60.00' })).toBeTruthy();
});

test('emptying the bag clears the promo, so a refilled bag starts undiscounted', async () => {
  bag.add(p42);
  const view = await render(<BagScreen {...handlers()} />);
  await fireEvent.changeText(view.getByLabelText('Promo code'), ' TRUE15 ');
  await flush();
  await fireEvent(view.getByLabelText('Promo code'), 'submitEditing');
  await flush();
  expect(view.getByText('Discount (15%)')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: `Remove ${p42.name}` }));
  await flush();
  expect(view.getByText('Your bag is empty')).toBeTruthy();
  expect(view.queryByText(DEMO_PROMO_LABEL)).toBeNull();
  bag.add(p42);
  await flush();
  expect(view.queryByText('Discount (15%)')).toBeNull();
  expect(view.getByRole('button', { name: 'Apply promo code' })).toBeTruthy();
});

test('the demo label covers the whole totals card (shipping, discount, total), not just the promo', async () => {
  bag.add(p42);
  const view = await render(<BagScreen {...handlers()} />);
  const card = within(view.getByTestId('bag-summary'));
  expect(card.getByText('Shipping')).toBeTruthy();
  expect(card.getByText('Total')).toBeTruthy();
  expect(DEMO_TOTALS_LABEL).toMatch(/shipping/i);
  expect(DEMO_TOTALS_LABEL).toMatch(/no purchases in this build/);
  expect(card.getByText(DEMO_TOTALS_LABEL)).toBeTruthy();
});

test('the bag carries the sample-catalog label once', async () => {
  bag.add(p42);
  const view = await render(<BagScreen {...handlers()} />);
  expect(view.getAllByText(SAMPLE_CATALOG_LABEL)).toHaveLength(1);
});
