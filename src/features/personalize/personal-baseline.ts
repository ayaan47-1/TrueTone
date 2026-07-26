// Per-dimension personal "normal" from the user's OWN scan history (newest-first).
// Median + MAD (not mean + stddev): robust to a single bad-lighting outlier scan.
// Pure and host-tested — mirrors the computeSkinFreshnessTrend pattern.
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import { MIN_SCANS, SPREAD_FLOOR } from './types';
import type { PersonalBaseline, PersonalSnapshot } from './types';

const MAD_SCALE = 1.4826; // makes MAD comparable to a standard deviation

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * history is newest-first (fetchScanHistory ordering). The latest scan (index 0) is
 * excluded — the baseline describes the user's PRIOR normal, so the latest read is
 * compared against it, not against itself. Stub scans never teach the baseline.
 * Returns null on cold start (< MIN_SCANS usable priors).
 */
export function computePersonalBaseline(history: PersonalSnapshot[]): PersonalBaseline | null {
  const priors = history.slice(1).filter((s) => !s.isStub && s.captureQuality !== 'poor');
  if (priors.length < MIN_SCANS) return null;
  const baseline: PersonalBaseline = {};
  for (const d of DIMENSIONS) {
    const values = priors.map((s) => s.scores[d]).filter((v) => Number.isFinite(v));
    if (values.length < MIN_SCANS) continue; // not enough valid priors for this dimension
    const center = median(values);
    const mad = median(values.map((v) => Math.abs(v - center)));
    baseline[d] = { center, spread: Math.max(mad * MAD_SCALE, SPREAD_FLOOR) };
  }
  return baseline;
}
