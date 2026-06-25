import { DIMENSIONS, type Dimension } from '../../content/cosmetic-vocab';
import type { ScoreVector } from '../read/read-types';
import type { ScoreSnapshot, SkinAgeTrend, TrendDirection } from './age-types';

// Polarity of each cosmetic dimension for a relative "freshness" read:
//  1  → higher score looks fresher (hydration)
// -1  → lower score looks fresher (visible texture/pores/spots/redness/lines/circles)
//  0  → neutral, excluded from the index (oiliness is not a freshness signal either way)
export const FRESHNESS_POLARITY: Record<Dimension, 1 | -1 | 0> = {
  hydration: 1,
  oiliness: 0,
  texture: -1,
  pores: -1,
  darkSpots: -1,
  redness: -1,
  fineLines: -1,
  darkCircles: -1,
};

const THRESHOLD = 0.02;

function freshnessIndex(scores: ScoreVector): number {
  let sum = 0;
  let n = 0;
  for (const d of DIMENSIONS) {
    const p = FRESHNESS_POLARITY[d];
    if (p === 0) continue;
    sum += p === 1 ? scores[d] : 1 - scores[d];
    n += 1;
  }
  return n === 0 ? 0 : sum / n;
}

function directionOf(delta: number): TrendDirection {
  if (delta > THRESHOLD) return 'fresher';
  if (delta < -THRESHOLD) return 'more-tired';
  return 'steady';
}

// history is newest-first (matches fetchScanHistory ordering). Compares the latest scan's freshness
// index against the mean of all earlier scans. Relative + within-user — no population claim.
export function computeSkinFreshnessTrend(history: ScoreSnapshot[]): SkinAgeTrend {
  if (history.length < 2) {
    return { direction: 'steady', delta: 0, sampleCount: history.length };
  }
  const [latest, ...earlier] = history;
  const latestIndex = freshnessIndex(latest.scores);
  const baseline = earlier.reduce((acc, s) => acc + freshnessIndex(s.scores), 0) / earlier.length;
  const delta = latestIndex - baseline;
  return { direction: directionOf(delta), delta, sampleCount: history.length };
}
