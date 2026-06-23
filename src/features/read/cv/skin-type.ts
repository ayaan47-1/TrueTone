// Maps the cosmetic scores to one of the four approved skin-type feels (deterministic, v1).
import type { ScoreVector, SkinTypeFeel } from '../read-types';

export function classify(scores: ScoreVector): SkinTypeFeel {
  if (scores.redness >= 0.6) return 'sensitive';
  if (scores.oiliness >= 0.6) return 'oily';
  if (scores.hydration <= 0.35) return 'dry';
  return 'combination';
}
