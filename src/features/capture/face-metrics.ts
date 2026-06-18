// src/features/capture/face-metrics.ts
//
// Pure mapping from face-detector output → FrameMetrics. Kept separate from the device-only
// frame-output wiring (use-frame-metrics.ts) so the math is fully unit-testable on the host.
import type { FrameMetrics } from './quality-gate';

export interface DetectedFaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Minimal shape of a vision-camera-face-detector `Face` (we only use its bounds). */
export interface DetectedFace {
  bounds: DetectedFaceBounds;
}

// The face detector reports presence/position/size but NOT exposure or focus. Until a luma-based
// frame processor is added, brightness/sharpness use neutral-pass values so the gate is driven by
// the real face signals (presence, centering, distance) without falsely failing on light/focus.
export const ASSUMED_BRIGHTNESS = 0.6;
export const ASSUMED_SHARPNESS = 0.7;

const NO_FACE: FrameMetrics = {
  faceDetected: false,
  faceCenteredness: 0,
  brightness: ASSUMED_BRIGHTNESS,
  sharpness: ASSUMED_SHARPNESS,
  faceFraction: 0,
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const area = (b: DetectedFaceBounds): number => Math.max(0, b.width) * Math.max(0, b.height);

/**
 * Map detected faces to a FrameMetrics for the quality gate. `faces` bounds MUST be in the same
 * coordinate space as windowWidth/windowHeight — use the detector's `autoMode` with the screen
 * dimensions so bounds arrive in screen pixels. The largest face wins.
 *
 * faceFraction is the LINEAR height fraction (face height / frame height) — that's what the
 * quality-gate thresholds (0.2–0.6) are calibrated against, not an area fraction.
 */
export function facesToMetrics(
  faces: readonly DetectedFace[],
  windowWidth: number,
  windowHeight: number,
): FrameMetrics {
  if (faces.length === 0 || windowWidth <= 0 || windowHeight <= 0) return NO_FACE;

  const face = faces.reduce((largest, f) => (area(f.bounds) > area(largest.bounds) ? f : largest));
  const b = face.bounds;
  const centerX = b.x + b.width / 2;
  const centerY = b.y + b.height / 2;
  const dx = (centerX - windowWidth / 2) / (windowWidth / 2);
  const dy = (centerY - windowHeight / 2) / (windowHeight / 2);
  const offset = Math.min(1, Math.hypot(dx, dy));

  return {
    faceDetected: true,
    faceCenteredness: clamp01(1 - offset),
    brightness: ASSUMED_BRIGHTNESS,
    sharpness: ASSUMED_SHARPNESS,
    faceFraction: clamp01(b.height / windowHeight),
  };
}
