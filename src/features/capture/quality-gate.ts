// src/features/capture/quality-gate.ts
export type FrameMetrics = {
  faceDetected: boolean;
  faceCenteredness: number; // 0..1, 1 = perfectly centered
  brightness: number;       // 0..1
  sharpness: number;        // 0..1
  faceFraction: number;     // 0..1, fraction of the frame the face occupies
  yaw: number;              // degrees, 0 = facing camera
  roll: number;             // degrees
  clipping: number;         // 0..1
  cct: number;              // Kelvin
  imbalance: number;        // 0..1
};

export type QualityReport = {
  face: boolean; lighting: boolean; focus: boolean; distance: boolean;
  glare: boolean; colour: boolean; evenness: boolean; pose: boolean;
  allPass: boolean; hint: string;
};

export const THRESHOLDS = {
  centeredness: 0.6,
  // GATES ON DIM AMBIENT (Approach A): requires a dark room (0.05-0.4) so the screen flash is the
  // dominant illuminant, solving the intensity/illuminant ambiguity that chroma metrics can't fix.
  // PROVISIONAL — must be re-validated on a real multi-lighting/multi-device set (spec §11).
  brightnessMin: 0.05, // Lowered to allow dim ambient
  brightnessMax: 0.4,  // Gated on dim ambient so screen flash can dominate
  sharpness: 0.5,
  faceFractionMin: 0.2, faceFractionMax: 0.6,
  // PROVISIONAL — must be re-tuned on a physical device (spec §11).
  clippingMax: 0.08,
  cctMin: 2700, cctMax: 7500,
  imbalanceMax: 0.35,
  poseMax: 20, // degrees of yaw or roll
  // How close to a threshold (as a fraction of headroom) still counts as "fair" rather than "good"
  // in qualityBand. PROVISIONAL — must be re-tuned on a physical device (spec §11).
  qualityBandMargin: 0.15,
} as const;

export function evaluateQuality(m: FrameMetrics): QualityReport {
  const face = m.faceDetected && m.faceCenteredness >= THRESHOLDS.centeredness;
  const lighting = m.brightness >= THRESHOLDS.brightnessMin && m.brightness <= THRESHOLDS.brightnessMax;
  const focus = m.sharpness >= THRESHOLDS.sharpness;
  const distance = m.faceFraction >= THRESHOLDS.faceFractionMin && m.faceFraction <= THRESHOLDS.faceFractionMax;
  const glare = m.clipping <= THRESHOLDS.clippingMax;
  const colour = m.cct >= THRESHOLDS.cctMin && m.cct <= THRESHOLDS.cctMax;
  const evenness = m.imbalance <= THRESHOLDS.imbalanceMax;
  const pose = Math.abs(m.yaw) <= THRESHOLDS.poseMax && Math.abs(m.roll) <= THRESHOLDS.poseMax;
  const allPass = face && lighting && focus && distance && glare && colour && evenness && pose;

  // Hint priority: get the face there, then straighten it, then fix the light, then framing.
  // Every hint describes LIGHT or FRAMING — never skin (CLAUDE.md §1).
  let hint = 'Looking good — hold still';
  if (!face) hint = 'Center your face in the oval';
  else if (!pose) hint = 'Face the camera straight on';
  else if (!glare) hint = 'Too much glare — turn away from the light';
  else if (!lighting) hint = m.brightness < THRESHOLDS.brightnessMin ? 'Too dark — add a little light' : 'Dim the room so the screen can light your face';
  else if (!colour) hint = 'Try more neutral light';
  else if (!evenness) hint = "Light's coming from one side";
  else if (!distance) hint = m.faceFraction < THRESHOLDS.faceFractionMin ? 'Move closer' : 'Move a little farther back';
  else if (!focus) hint = 'Hold steady to focus';

  return { face, lighting, focus, distance, glare, colour, evenness, pose, allPass, hint };
}

// Coarse band persisted with the scan so the trend engine can skip incomparable reads (spec §5a).
// Three-valued on purpose: it must carry no reconstructable detail about the scene.
export function qualityBand(m: FrameMetrics): 'good' | 'fair' | 'poor' {
  const r = evaluateQuality(m);
  if (!r.allPass) return 'poor';
  const margins = [
    1 - m.clipping / THRESHOLDS.clippingMax,
    1 - m.imbalance / THRESHOLDS.imbalanceMax,
    1 - Math.abs(m.yaw) / THRESHOLDS.poseMax,
    1 - Math.abs(m.roll) / THRESHOLDS.poseMax,
  ];
  return Math.min(...margins) < THRESHOLDS.qualityBandMargin ? 'fair' : 'good';
}
