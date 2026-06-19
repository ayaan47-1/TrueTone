import type { CategoryKey } from './library';
import type { RecommendationAttrs } from '../routine-types';

const ELEVATED = 0.6;
const LOW = 0.4;

// Deterministic, order-stable selection. Pushed in a fixed order so the routine reads sensibly.
export function selectCategories(attrs: RecommendationAttrs): CategoryKey[] {
  const { scores: s, skinType } = attrs;
  const keys: CategoryKey[] = ['gentle_cleanser'];

  if (skinType === 'oily' || s.oiliness >= ELEVATED) {
    keys.push('oil_control');
  } else if (s.hydration <= LOW) {
    keys.push('hydrating_serum');
  }
  if (skinType === 'sensitive' || s.redness >= ELEVATED) keys.push('soothing_moisturizer');
  if (s.texture >= ELEVATED || s.pores >= ELEVATED) keys.push('gentle_exfoliant');
  if (s.darkSpots >= ELEVATED) keys.push('brightening_serum');
  if (s.darkCircles >= ELEVATED) keys.push('eye_care');
  if (s.fineLines >= ELEVATED) keys.push('barrier_moisturizer');

  keys.push('daily_spf'); // always last in AM ordering
  return keys;
}
