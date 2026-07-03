// Expresses the latest read relative to the user's OWN baseline: z-score per dimension,
// classified above/below/within, with a "favorable" flag derived from the existing
// freshness polarity (reused from skin-age-trend — single source of truth).
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import type { ScoreVector } from '../read/read-types';
import { FRESHNESS_POLARITY } from '../age/skin-age-trend';
import { Z_THRESHOLD } from './types';
import type { DeviationStatus, PersonalBaseline, PersonalDeviation } from './types';

export function computePersonalDeviation(
  latest: ScoreVector,
  baseline: PersonalBaseline,
): PersonalDeviation {
  const deviation: PersonalDeviation = {};
  for (const d of DIMENSIONS) {
    const b = baseline[d];
    const value = latest[d];
    if (!b || !Number.isFinite(value)) continue; // no baseline or malformed latest → omit
    const z = (value - b.center) / b.spread; // spread is already floored by the baseline
    const status: DeviationStatus = z > Z_THRESHOLD ? 'above' : z < -Z_THRESHOLD ? 'below' : 'within';
    const polarity = FRESHNESS_POLARITY[d];
    const favorable =
      status === 'within' || polarity === 0
        ? null
        : polarity === 1
          ? status === 'above'
          : status === 'below';
    deviation[d] = { status, z, favorable };
  }
  return deviation;
}
