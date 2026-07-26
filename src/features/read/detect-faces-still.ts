// DEVICE-ONLY: MLKit still-image face detection on the captured photo.
//
// Compliance (spec §3a, founder-approved 2026-07-25): this is an existing API of
// react-native-vision-camera-face-detector, already installed and already processing face data
// on-device via the live detector. No new vendor, no package.json change. The photo is read
// locally and deleted by withImageCleanup; nothing crosses the compliance boundary.
//
// MLKit has no arm64 iOS-simulator slice, so this returns null there rather than crashing.
import type { DetectedFace } from './face-geometry';

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

export async function detectFacesOnStill(uri: string): Promise<DetectedFace | null> {
  try {
    const faces = detector().detectFaces({ uri }) as unknown[];
    if (!Array.isArray(faces) || faces.length === 0) return null;
    const face = faces.reduce((best, f) => (area(f) > area(best) ? f : best));
    const bounds = readBounds(face);
    if (!bounds || area(face) <= 0) return null;
    const contours = (face as Record<string, unknown>).contours as DetectedFace['contours'];
    return { bounds, contours };
  } catch {
    // Simulator, missing native module, unreadable file — fall back to the proportional path.
    return null;
  }
}
