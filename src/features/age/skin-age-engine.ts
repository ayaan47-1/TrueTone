// src/features/age/skin-age-engine.ts
import { DIMENSIONS } from '../../content/cosmetic-vocab';
import type { ReadResult } from '../read/read-types';
import type { SkinAgeEstimate } from './age-types';
import { SKIN_AGE_ABSOLUTE_ENABLED } from './age-flags';

export const AGE_MODEL_VERSION = 'age-stub-1';

// Placeholder deterministic transform mapping appearance scores -> a "looks like ~N" estimate.
// DEVICE-ONLY: the real implementation swaps this for an on-device executorch model that runs in the
// same pass as the read, before the image is deleted. Until validation data is on file, the whole
// path is gated dark by SKIN_AGE_ABSOLUTE_ENABLED and estimateSkinAge returns null.
function transform(read: ReadResult): SkinAgeEstimate {
  // Lines/spots/texture push the estimate up; hydration pulls it down. Centered around a base age.
  const s = read.scores;
  const visible = (s.fineLines + s.darkSpots + s.texture + s.darkCircles) / 4;
  const raw = 25 + visible * 40 - s.hydration * 8;
  const ageEstimate = Math.max(0, Math.min(120, Math.round(raw)));
  const spread = DIMENSIONS.reduce((acc, d) => acc + Math.abs(s[d] - 0.5), 0) / DIMENSIONS.length;
  const confidence = Math.max(0, Math.min(1, Number((0.4 + spread).toFixed(3))));
  return { ageEstimate, confidence, modelVersion: AGE_MODEL_VERSION };
}

export function estimateSkinAge(read: ReadResult): SkinAgeEstimate | null {
  if (!SKIN_AGE_ABSOLUTE_ENABLED) return null;
  return transform(read);
}
