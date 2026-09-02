// src/features/foryou/__tests__/ProductRail.test.tsx
// The horizontal For You rail. With a profile it shows the compliant fit % (40..99) and
// a single Best-match badge on the top card; without one it stays neutral (no fit %).
// Renders are ASYNC in this repo (gotcha a): await render, query via `view`.
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProductRail } from '../ProductRail';
import { resolveForYouProfile } from '../for-you-profile';
import { catalog } from '../../match/product-catalog';
import { rankedForFilter } from '../../match/sort';
import { bag, bagCount } from '../../checkout/bag-store';
import { DEFAULT_SETUP_ANSWERS } from '../../preferences/preferences-types';

const demoProfile = resolveForYouProfile(false, null, DEFAULT_SETUP_ANSWERS, true)!;
const rankedItems = rankedForFilter(catalog, demoProfile, 'all')
  .slice(0, 8)
  .map((s) => ({ product: s.product, isBestMatch: s.isBestMatch }));

describe('ProductRail', () => {
  beforeEach(() => bag.clear());

  test('ranked against the demo stub shade: shows fit % and one Best-match badge', async () => {
    const view = await render(
      <ProductRail title="Your products" subtitle="Picked for your shade" items={rankedItems} profile={demoProfile} />,
    );
    expect(view.getByText('Your products')).toBeTruthy();
    expect(view.getByText('Picked for your shade')).toBeTruthy();
    expect(view.getAllByText(/% fit/).length).toBeGreaterThan(0);
    expect(view.getAllByTestId('rail-best-match')).toHaveLength(1);
  });

  test('neutral (no profile) rail shows no fit %', async () => {
    const items = catalog.slice(0, 5).map((product) => ({ product }));
    const view = await render(<ProductRail title="Featured products" items={items} />);
    expect(view.queryAllByText(/% fit/)).toHaveLength(0);
    expect(view.queryByTestId('rail-best-match')).toBeNull();
  });

  test('tapping a card add button adds the product to the bag', async () => {
    const view = await render(
      <ProductRail title="Your products" items={rankedItems} profile={demoProfile} />,
    );
    const top = rankedItems[0].product;
    fireEvent.press(view.getByTestId(`rail-add-${top.id}`));
    await waitFor(() => expect(bag.count()).toBe(1));
  });
});
