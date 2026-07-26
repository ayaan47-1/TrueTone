import type { CategoryKey } from './library';
import type { RecommendationAttrs } from '../routine-types';

const ELEVATED = 0.6;
const LOW = 0.4;

// Deterministic, order-stable selection. Pushed in a fixed order so the routine reads sensibly.
export function selectCategories(attrs: RecommendationAttrs): CategoryKey[] {
  const { scores: s, skinType } = attrs;
  const keys: CategoryKey[] = ['gentle_cleanser'];

  // *** KNOWN MEASUREMENT DEFECTS UPSTREAM OF THIS BRANCH (fairness work, 2026-07-26). ***
  // Recorded here because this is where two compromised scores turn into a recommendation. The
  // thresholds are NOT the defect — do not adjust ELEVATED or LOW to compensate.
  //
  // oil_control gates on oiliness >= 0.6. On Fitzpatrick I-III that score measures SENSOR
  // SATURATION, not specularity. Firing the underlying chroma gate needs specular radiance
  // S >= 1.857*D, but an 8-bit pixel caps at white so at most 1-D is available: FST I needs 1.331
  // against 0.283 available, FST II 1.154 against 0.378, FST III 0.889 against 0.521. No unclipped
  // pixel can satisfy it at any shine level, and measurement agrees — the weight carried by
  // fully-unclipped pixels is w_clean = 0.0000 at all three tones. Every count on light skin comes
  // from a clipped pixel whose chroma reads 0 only because the sensor ran out of range. A
  // light-skinned user shot under a blown highlight can therefore cross 0.6 on exposure alone.
  //
  // Note `skinType === 'oily'` is NOT an independent path: skin-type.ts's classify() returns
  // 'oily' on scores.oiliness >= 0.6, the same threshold, so the first disjunct is subsumed by the
  // second and this branch is driven entirely by the one compromised score.
  //
  // hydrating_serum gates on hydration <= 0.4, and hydration is defined as 1 - texture (identical
  // CAL ranges), so that is exactly texture >= 0.6. texture carries a tone-dependent FLOOR from
  // additive sensor noise measured against a tone-proportional reference — the Weber ratio dY/Y is
  // 0.56% at FST I against 3.79% at FST VI. It is worst on CLEAN skin (spread 0.0897 at defect 0,
  // rising I 0.0361 -> VI 0.1258), so darker tones are biased toward this branch with no defect
  // present at all.
  //
  // The if/else COUPLES them: a false-positive oiliness does not merely add oil_control, it
  // suppresses hydrating_serum entirely regardless of the hydration score.
  //
  // Both effects are measured on the synthetic harness only and are UNVERIFIED ON REAL FACES.
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
