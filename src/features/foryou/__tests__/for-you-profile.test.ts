// src/features/foryou/__tests__/for-you-profile.test.ts
// The pure profile resolver for the For You rails. It never touches the raw image
// (CLAUDE.md §3) — it maps the already-derived shade (or a fixed demo stub) + the
// structured Setup prefs into the single MatchProfile the ranking boundary consumes.
import {
  DEMO_SHADE,
  resolveForYouProfile,
  FEATURED_IDS,
  featuredProducts,
} from '../for-you-profile';
import { catalog } from '../../match/product-catalog';
import { rankedForFilter } from '../../match/sort';
import { DEFAULT_SETUP_ANSWERS } from '../../preferences/preferences-types';
import type { CurrentShade } from '../../session/personalization';

const SCANNED: CurrentShade = { shadeName: 'Tan Warm', undertone: 'warm', depth: 8, finish: 'satin' };

describe('resolveForYouProfile', () => {
  test('uses the real derived shade once scanned, combined with prefs', () => {
    const profile = resolveForYouProfile(true, SCANNED, DEFAULT_SETUP_ANSWERS, false);
    expect(profile).toEqual({
      shade: 8,
      undertone: 'warm',
      coverage: DEFAULT_SETUP_ANSWERS.coverage,
      skips: DEFAULT_SETUP_ANSWERS.skips,
    });
  });

  test('falls back to the fixed demo stub shade when DEMO_MODE is on and unscanned', () => {
    const profile = resolveForYouProfile(false, null, DEFAULT_SETUP_ANSWERS, true);
    expect(profile).toMatchObject({ shade: DEMO_SHADE.depth, undertone: DEMO_SHADE.undertone });
    // The demo stub is an inclusive mid-deep neutral shade so the rail is populated.
    expect(profile?.shade).toBe(6);
    expect(profile?.undertone).toBe('neutral');
  });

  test('returns undefined (neutral "find your shade" state) when unscanned and not demo', () => {
    expect(resolveForYouProfile(false, null, DEFAULT_SETUP_ANSWERS, false)).toBeUndefined();
  });

  test('the demo stub actually ranks products (rail is not empty)', () => {
    const profile = resolveForYouProfile(false, null, DEFAULT_SETUP_ANSWERS, true)!;
    const ranked = rankedForFilter(catalog, profile, 'all');
    expect(ranked.length).toBeGreaterThan(0);
    // Exactly one best-match badge on the top card.
    expect(ranked.filter((r) => r.isBestMatch)).toHaveLength(1);
    // Every fit sits in the compliant 40..99 band.
    ranked.forEach((r) => {
      expect(r.fit).toBeGreaterThanOrEqual(40);
      expect(r.fit).toBeLessThanOrEqual(99);
    });
  });
});

describe('featuredProducts', () => {
  test('maps every FEATURED_ID to a real catalog product, in order', () => {
    const featured = featuredProducts();
    expect(featured).toHaveLength(FEATURED_IDS.length);
    expect(featured.map((p) => p.id)).toEqual([...FEATURED_IDS]);
  });

  test('spans a diverse, inclusive shade range (fair→deep across undertones)', () => {
    const featured = featuredProducts();
    const depths = featured.map((p) => p.shade);
    // Reaches both the fair end and the deep end of the 1..10 range.
    expect(Math.min(...depths)).toBeLessThanOrEqual(2);
    expect(Math.max(...depths)).toBeGreaterThanOrEqual(9);
    // Covers at least three undertone families.
    expect(new Set(featured.map((p) => p.undertone)).size).toBeGreaterThanOrEqual(3);
  });
});
