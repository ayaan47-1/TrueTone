// src/features/foryou/for-you-profile.ts
// Pure helpers for the For You product rails. These live INSIDE the compliance
// boundary (CLAUDE.md §3): they consume only the already-derived shade descriptors
// (depth + undertone) and the structured Setup prefs — never the raw image, a URI, or
// bytes. No I/O, no store, no randomness.
import type { MatchProfile, Product, ShadeDepth } from '../match/match-types';
import type { Undertone } from '../../content/makeup-vocab';
import type { CurrentShade } from '../session/personalization';
import type { SetupAnswers } from '../preferences/preferences-types';
import { catalog } from '../match/product-catalog';
import { rankedForFilter } from '../match/sort';

/**
 * Fixed demo stub shade. `currentShade` is null in the running app (the camera → shade
 * engine wiring is out of scope), so in DEMO_MODE we seed one inclusive mid-deep neutral
 * shade purely so the "Picked for your shade" rail renders a ranked shelf. It is a demo
 * preview convenience ONLY — it never relaxes the age-gate/consent chain (that is
 * enforced upstream) and consumes no image data.
 */
export const DEMO_SHADE: { readonly depth: ShadeDepth; readonly undertone: Undertone } = {
  depth: 6,
  undertone: 'neutral',
};

/**
 * Build the ONE MatchProfile the rails rank against — never the raw image (CLAUDE.md §3):
 *   1. a real scan → the derived shade + prefs;
 *   2. else DEMO_MODE → the fixed demo stub shade + prefs (so the rail is populated);
 *   3. else undefined → the caller shows a neutral "find your shade" state.
 */
export function resolveForYouProfile(
  hasScanned: boolean,
  currentShade: CurrentShade | null,
  prefs: SetupAnswers,
  demoMode: boolean,
): MatchProfile | undefined {
  const base =
    hasScanned && currentShade
      ? { shade: currentShade.depth, undertone: currentShade.undertone }
      : demoMode
        ? { shade: DEMO_SHADE.depth, undertone: DEMO_SHADE.undertone }
        : null;
  if (!base) return undefined;
  return { ...base, coverage: prefs.coverage, skips: prefs.skips };
}

/**
 * A curated "Featured" set that deliberately spans the full inclusive shade range —
 * fair → deep across warm / cool / neutral / olive undertones — so the rail showcases
 * the range for every tone rather than only the user's own. Hand-picked ids from the
 * catalog; kept lightweight.
 */
export const FEATURED_IDS = [
  'sol-second-05', // Porcelain 1N — fair, neutral
  'lum-tint-01', //   Ivory 2C — fair, cool
  'sol-tint-06', //   Olive 4O — light, olive
  'ver-velvet-10', //  Honey 5W — medium, warm
  'sol-silk-08', //   Chestnut 8W — tan, warm
  'ver-dewy-11', //   Mocha 9N — deep, neutral
  'aur-comfort-14', // Espresso 10C — deep, cool
] as const;

/** Resolve FEATURED_IDS to real catalog products, preserving order. */
export function featuredProducts(products: readonly Product[] = catalog): Product[] {
  return FEATURED_IDS.map((id) => products.find((p) => p.id === id)).filter(
    (p): p is Product => p !== undefined,
  );
}

/** How many products the "Picked for your shade" rail shows. */
export const PICKED_FOR_YOU_COUNT = 8;

/**
 * The "Picked for your shade" rail: the catalog ranked best-first against `profile`
 * (scoring.ts + sort.ts's documented tiebreak — same engine ShopList uses), trimmed to
 * a rail-sized slice. Ranking logic is not duplicated here, only composed.
 */
export function pickedForYourShade(
  profile: MatchProfile,
  products: readonly Product[] = catalog,
  count: number = PICKED_FOR_YOU_COUNT,
): Product[] {
  return rankedForFilter(products, profile, 'all')
    .slice(0, count)
    .map((scored) => scored.product);
}
