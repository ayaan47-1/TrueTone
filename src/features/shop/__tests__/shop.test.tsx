// src/features/shop/__tests__/shop.test.tsx
// Shop integration: the hasScanned gate (plan Flag 3). Pre-scan the shelf is neutral —
// no fit %. Post-scan it ranks a shimmer product lower, shows fit pills, and badges the
// single best card. Renders are ASYNC (repo gotcha a): await render, query via `view`.
import { render } from '@testing-library/react-native';
import { ShopList } from '../ShopList';
import type { MatchProfile } from '../../match/match-types';

// coverage:'light' (glam −9) + skips heavy_shimmer (−14) — the E2E preference shape.
const SCANNED_PROFILE: MatchProfile = {
  shade: 5,
  undertone: 'warm',
  coverage: 'light',
  skips: ['heavy_shimmer'],
};

describe('ShopList', () => {
  test('pre-scan (no profile) renders neutrally — no fit %', async () => {
    const view = await render(<ShopList />);

    expect(view.queryAllByTestId('fit-pill')).toHaveLength(0);
    expect(view.queryAllByText(/%/)).toHaveLength(0);
    expect(view.queryByTestId('best-match-badge')).toBeNull();
    expect(view.getAllByText('Shades available').length).toBeGreaterThan(0);
  });

  test('post-scan ranks shimmer lower, shows fit pills + a single Best match top card', async () => {
    const view = await render(<ShopList profile={SCANNED_PROFILE} />);

    // Fit pills appear once a profile is present.
    expect(view.getAllByTestId('fit-pill').length).toBeGreaterThan(0);
    expect(view.queryByText('Shades available')).toBeNull();

    // Exactly one Best-match badge, on the top card.
    expect(view.getAllByTestId('best-match-badge')).toHaveLength(1);

    const names = view.getAllByTestId('product-name').map((n) => n.props.children);
    // Three catalog products share this profile's exact shade (5) + undertone (warm), so
    // all three hit the 99% fit ceiling: Lumira Full-Cover Concealer (matte), Lumira Satin
    // Lip Color (satin), Veranda Velvet Matte Foundation (matte). rank()'s documented
    // tiebreak is alphabetical by name (sort.ts), and "Full-Cover" < "Satin" < "Velvet" —
    // Lumira Full-Cover Concealer wins the top card.
    expect(names[0]).toBe('Lumira Full-Cover Concealer');
    // Solene Shimmer Eye Quad shares the same shade/undertone (also a 99% seed) but is the
    // catalog's only hasShimmer product, so profile.skips=['heavy_shimmer'] (−14) plus its
    // glam finish under coverage:'light' (−9) drop it to 76% — well below the 99% cluster.
    const shimmerIdx = names.indexOf('Solene Shimmer Eye Quad');
    expect(shimmerIdx).toBeGreaterThan(0);
    expect(shimmerIdx).toBeGreaterThan(names.indexOf('Lumira Full-Cover Concealer'));
  });
});
