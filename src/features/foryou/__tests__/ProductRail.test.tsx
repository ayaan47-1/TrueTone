// src/features/foryou/__tests__/ProductRail.test.tsx
// Renders are ASYNC (repo gotcha a): await render, query via `view`.
import { render } from '@testing-library/react-native';
import { ProductRail } from '../ProductRail';
import { pickedForYourShade, featuredProducts, DEMO_SHADE } from '../for-you-profile';
import type { MatchProfile } from '../../match/match-types';

const DEMO_PROFILE: MatchProfile = {
  shade: DEMO_SHADE.depth,
  undertone: DEMO_SHADE.undertone,
  coverage: 'everyday',
  skips: [],
};

describe('ProductRail', () => {
  test('"Picked for your shade" renders products ranked off the demo stub shade', async () => {
    const picks = pickedForYourShade(DEMO_PROFILE);
    expect(picks.length).toBeGreaterThan(0);

    const view = await render(
      <ProductRail title="Your products" subtitle="Picked for your shade" products={picks} profile={DEMO_PROFILE} />,
    );

    expect(view.getByText('Your products')).toBeTruthy();
    expect(view.getByText('Picked for your shade')).toBeTruthy();
    // Best-first ranking (sort.ts): the top pick is the only card badged.
    expect(view.getByTestId(`product-${picks[0].id}`)).toBeTruthy();
    expect(view.getAllByTestId('best-match-badge')).toHaveLength(1);
    // Every ranked pick actually renders in the rail, in order.
    const names = view.getAllByTestId('product-name').map((n) => n.props.children);
    expect(names).toEqual(picks.map((p) => p.name));
  });

  test('Featured renders its diverse fair->deep set, no fit signal', async () => {
    const featured = featuredProducts();
    expect(featured.length).toBeGreaterThan(0);

    const view = await render(<ProductRail title="Featured products" products={featured} />);

    expect(view.getByText('Featured products')).toBeTruthy();
    // No profile -> ProductCard's neutral state, no fit pill or best-match badge.
    expect(view.queryAllByTestId('fit-pill')).toHaveLength(0);
    expect(view.queryByTestId('best-match-badge')).toBeNull();
    const names = view.getAllByTestId('product-name').map((n) => n.props.children);
    expect(names).toEqual(featured.map((p) => p.name));
  });

  test('renders nothing for an empty product list', async () => {
    const view = await render(<ProductRail title="Empty rail" products={[]} />);
    expect(view.queryByText('Empty rail')).toBeNull();
  });
});
