// src/features/match/scoring.ts
// The single compatibility-fit boundary. The ONLY number this module emits is a fit %
// in 40..99 — a shade/preference match, never a skin or health score (CLAUDE.md §3, Flag 4).
import type { Product, MatchProfile, ShadeDepth } from './match-types';
import type { Undertone } from '../../content/makeup-vocab';

const FIT_FLOOR = 40;
const FIT_CEIL = 99;

/** Clamp any raw score into the allowed 40..99 fit band and round to an integer. */
export function clampFit(n: number): number {
  return Math.max(FIT_FLOOR, Math.min(FIT_CEIL, Math.round(n)));
}

function undertonePenalty(a: Undertone, b: Undertone): number {
  if (a === b) return 0;
  if (a === 'neutral' || b === 'neutral') return 4;
  const pair = new Set<Undertone>([a, b]);
  if (pair.has('warm') && pair.has('olive')) return 6;
  if (pair.has('cool') && pair.has('olive')) return 10;
  if (pair.has('warm') && pair.has('cool')) return 14;
  // forward-compat default for a future undertone value
  return 8;
}

/** Seed fit from shade-depth proximity + undertone match. Always within 40..99. */
export function baseShadeUndertoneFit(
  product: Product,
  shade: ShadeDepth,
  undertone: Undertone,
): number {
  const shadeDiff = Math.abs(product.shade - shade);
  return clampFit(FIT_CEIL - shadeDiff * 8 - undertonePenalty(product.undertone, undertone));
}

/** Apply the user's coverage + skip preferences to a seed fit. Pure; returns a new number. */
export function applyPreferences(seed: number, product: Product, profile: MatchProfile): number {
  let score = seed;
  switch (profile.coverage) {
    case 'light':
      if (product.finish === 'sheer') score += 2;
      if (product.finish === 'glam') score -= 9;
      break;
    case 'glam':
      if (product.finish === 'glam') score += 5;
      break;
    case 'everyday':
      break; // no coverage adjustment
    default: {
      // exhaustiveness guard: adding a Coverage value forces a compile error here.
      const _never: never = profile.coverage;
      return _never;
    }
  }
  if (profile.skips.includes('heavy_shimmer') && product.hasShimmer) score -= 14;
  if (profile.skips.includes('drying_matte') && product.finish === 'dewy') score += 3;
  // 'fragrance' & 'full_coverage' skips carry NO score adjustment (filters only, god ruling).
  return score;
}

/** Compute a product's compatibility fit % (40..99) for a given user profile. */
export function scoreProduct(product: Product, profile: MatchProfile): number {
  const seed = baseShadeUndertoneFit(product, profile.shade, profile.undertone);
  return clampFit(applyPreferences(seed, product, profile));
}
