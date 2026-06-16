// src/features/capture/quality-gate.ts
export type FrameMetrics = {
  faceDetected: boolean;
  faceCenteredness: number; // 0..1, 1 = perfectly centered
  brightness: number;       // 0..1
  sharpness: number;        // 0..1
  faceFraction: number;     // 0..1, fraction of the frame the face occupies
};

export type QualityReport = {
  face: boolean; lighting: boolean; focus: boolean; distance: boolean;
  allPass: boolean; hint: string;
};

export const THRESHOLDS = {
  centeredness: 0.6,
  brightnessMin: 0.35, brightnessMax: 0.9,
  sharpness: 0.5,
  faceFractionMin: 0.2, faceFractionMax: 0.6,
};

export function evaluateQuality(m: FrameMetrics): QualityReport {
  const face = m.faceDetected && m.faceCenteredness >= THRESHOLDS.centeredness;
  const lighting = m.brightness >= THRESHOLDS.brightnessMin && m.brightness <= THRESHOLDS.brightnessMax;
  const focus = m.sharpness >= THRESHOLDS.sharpness;
  const distance = m.faceFraction >= THRESHOLDS.faceFractionMin && m.faceFraction <= THRESHOLDS.faceFractionMax;
  const allPass = face && lighting && focus && distance;

  // Hint priority: position the face, then light, then distance, then focus.
  let hint = 'Looking good — hold still';
  if (!face) hint = 'Center your face in the oval';
  else if (!lighting) hint = m.brightness < THRESHOLDS.brightnessMin ? 'Move into better light' : 'Too bright — reduce glare';
  else if (!distance) hint = m.faceFraction < THRESHOLDS.faceFractionMin ? 'Move closer' : 'Move a little farther back';
  else if (!focus) hint = 'Hold steady to focus';

  return { face, lighting, focus, distance, allPass, hint };
}
