// DEVICE-ONLY: local Apple Vision. The enclosing withImageCleanup owns photo deletion.
import type { DetectedFace } from './face-geometry';
import { createFaceDetector } from '../capture/apple-vision-detector';
import { visionStillFaces } from '../capture/apple-vision-mapping';
import { classifyDetection, reportModuleUnavailable, reportThrew, type StillDetectionReport } from './still-detection-diagnostics';

export interface StillDetectionResult {
  face: DetectedFace | null;
  report: StillDetectionReport;
}

export async function detectFacesOnStillDetailed(uri: string): Promise<StillDetectionResult> {
  let detector: ReturnType<typeof createFaceDetector>;
  try { detector = createFaceDetector(); }
  catch { return { face: null, report: reportModuleUnavailable(new Error('Apple Vision detector unavailable')) }; }
  try {
    const faces = visionStillFaces(detector.detectStill(uri));
    const face = faces.reduce<DetectedFace | null>((largest, next) =>
      !largest || next.bounds.width * next.bounds.height > largest.bounds.width * largest.bounds.height ? next : largest, null);
    return { face, report: classifyDetection(faces, faces.length) };
  } catch {
    return { face: null, report: reportThrew(new Error('Local face detection failed')) };
  } finally { detector.dispose(); }
}

export async function detectFacesOnStill(uri: string): Promise<DetectedFace | null> {
  return (await detectFacesOnStillDetailed(uri)).face;
}
