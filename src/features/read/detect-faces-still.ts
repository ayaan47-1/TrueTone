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

const area = (f: any) => Math.max(0, f?.bounds?.width ?? 0) * Math.max(0, f?.bounds?.height ?? 0);

export async function detectFacesOnStill(uri: string): Promise<DetectedFace | null> {
  try {
    const faces = detector().detectFaces({ uri }) as any[];
    if (!Array.isArray(faces) || faces.length === 0) return null;
    const face = faces.reduce((best, f) => (area(f) > area(best) ? f : best));
    if (!face?.bounds || area(face) <= 0) return null;
    return { bounds: face.bounds, contours: face.contours };
  } catch {
    // Simulator, missing native module, unreadable file — fall back to the proportional path.
    return null;
  }
}
