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
    // A close-shade (99% fit), non-shimmer product wins the top card (name tiebreak);
    // the shimmer glam foundation (−14 shimmer, −9 glam) ranks well below it.
    expect(names[0]).toBe('Satin Lip Color');
    const shimmerIdx = names.indexOf('Full-Glam Foundation');
    expect(shimmerIdx).toBeGreaterThan(0);
    expect(shimmerIdx).toBeGreaterThan(names.indexOf('Satin Lip Color'));
  });
});
