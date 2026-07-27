// DEVICE-ONLY: MLKit still-image face detection on the captured photo.
//
// Compliance (spec §3a, founder-approved 2026-07-25): this is an existing API of
// react-native-vision-camera-face-detector, already installed and already processing face data
// on-device via the live detector. No new vendor, no package.json change. The photo is read
// locally and deleted by withImageCleanup; nothing crosses the compliance boundary.
//
// MLKit has no arm64 iOS-simulator slice, so this returns null there rather than crashing.
import type { DetectedFace } from './face-geometry';
import {
  classifyDetection,
  reportModuleUnavailable,
  reportThrew,
  type StillDetectionReport,
} from './still-detection-diagnostics';

type StillDetector = { detectFaces: (image: { uri: string }) => unknown[] };

let cached: StillDetector | null = null;

function detector(): StillDetector {
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createImageFaceDetector } = require('react-native-vision-camera-face-detector');
    cached = createImageFaceDetector({
      performanceMode: 'accurate',
      runContours: true,
      runLandmarks: false,
      runClassifications: false,
      trackingEnabled: false, // MLKit: contours imply single-face; tracking would be wasted work
    });
  }
  return cached as StillDetector;
}

interface RawFaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Runtime type guard: the native module's return shape is invisible to tsc, so a shape mismatch
// (a renamed field, a null bounds) must be caught here rather than flowing through as `any`.
function readBounds(f: unknown): RawFaceBounds | null {
  if (!f || typeof f !== 'object') return null;
  const b = (f as Record<string, unknown>).bounds;
  if (!b || typeof b !== 'object') return null;
  const r = b as Record<string, unknown>;
  const { x, y, width, height } = r;
  if (
    typeof x === 'number' && Number.isFinite(x) &&
    typeof y === 'number' && Number.isFinite(y) &&
    typeof width === 'number' && Number.isFinite(width) &&
    typeof height === 'number' && Number.isFinite(height)
  ) {
    return { x, y, width, height };
  }
  return null;
}

function area(f: unknown): number {
  const b = readBounds(f);
  return b ? Math.max(0, b.width) * Math.max(0, b.height) : 0;
}

export interface StillDetectionResult {
  face: DetectedFace | null;
  /** What actually happened, for the dev overlay. The production path ignores this. */
  report: StillDetectionReport;
}

/**
 * The same detection as `detectFacesOnStill`, but reporting WHICH failure occurred rather than
 * collapsing all of them into `null`. Used by app/(dev)/bbox-overlay.tsx.
 *
 * On the device pass this distinction was the whole problem: an upright, well-lit, well-framed
 * portrait produced "detector found a face: no", which could equally have meant the native module
 * was missing, the call threw on the URI form, MLKit genuinely saw nothing, or faces came back in
 * a shape `readBounds` could not parse. Four different fixes behind one word.
 */
export async function detectFacesOnStillDetailed(uri: string): Promise<StillDetectionResult> {
  let detect: StillDetector;
  try {
    detect = detector();
  } catch (err) {
    // Simulator (no arm64 MLKit slice), unlinked native module, aliased dev stub.
    return { face: null, report: reportModuleUnavailable(err) };
  }

  let faces: unknown;
  try {
    faces = detect.detectFaces({ uri });
  } catch (err) {
    return { face: null, report: reportThrew(err) };
  }

  const list = Array.isArray(faces) ? faces : [];
  const usable = list.filter((f) => readBounds(f) !== null && area(f) > 0);
  const report = classifyDetection(faces, usable.length);
  if (usable.length === 0) return { face: null, report };

  const best = usable.reduce((a, b) => (area(b) > area(a) ? b : a));
  const bounds = readBounds(best)!;
  const contours = (best as Record<string, unknown>).contours as DetectedFace['contours'];
  return { face: { bounds, contours }, report };
}

export async function detectFacesOnStill(uri: string): Promise<DetectedFace | null> {
  try {
    const { face } = await detectFacesOnStillDetailed(uri);
    return face;
  } catch {
    // Belt and braces: the read must degrade to the proportional path, never throw.
    return null;
  }
}
