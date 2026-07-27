// Per-user personalization types + method constants.
// Constants are PROVISIONAL heuristics (same convention as CAL in cv/calibration.ts):
// safe to tune because every output is a relative, within-user statement — never an
// absolute or population claim (spec §1, §3).
import type { Dimension } from '../../content/cosmetic-vocab';
import type { ScoreVector } from '../read/read-types';

/** Minimum non-stub PRIOR scans required before a personal baseline exists. */
export const MIN_SCANS = 3;
/** Spread floor so near-identical history doesn't flag everything as "off". */
export const SPREAD_FLOOR = 0.05;
/** Deviation beyond the user's own normal variation, in spread units. */
export const Z_THRESHOLD = 1.0;
/** Messaging stays scannable. */
export const MAX_MESSAGES = 3;

/** One scan's contribution to the personal history (derived scores only — no image). */
export interface PersonalSnapshot {
  scores: ScoreVector;
  isStub: boolean;
  /**
   * Coarse capture-quality band from the scan that produced this snapshot. `'poor'` and
   * `null`/`undefined` (unknown — e.g. a pre-migration scan) are both treated as not
   * comparable and excluded from the baseline, so a bad capture never pulls a user's
   * personal "normal" off course.
   */
  captureQuality?: 'good' | 'fair' | 'poor' | null;
}

export interface DimensionBaseline {
  center: number; // median of prior scores, 0..1
  spread: number; // MAD * 1.4826, floored at SPREAD_FLOOR
}

/** Partial: a dimension without enough valid priors is simply absent. */
export type PersonalBaseline = Partial<Record<Dimension, DimensionBaseline>>;

export type DeviationStatus = 'above' | 'below' | 'within';

export interface DimensionDeviation {
  status: DeviationStatus;
  z: number; // (latest - center) / spread
  favorable: boolean | null; // null when 'within' or when polarity is 0 (oiliness)
}

/** Partial: only dimensions present in the baseline (with a valid latest value) appear. */
export type PersonalDeviation = Partial<Record<Dimension, DimensionDeviation>>;
