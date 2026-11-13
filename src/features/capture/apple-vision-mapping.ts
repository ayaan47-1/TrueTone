import { z } from 'zod';
import type { DetectedFace as PreviewFace } from './face-metrics';
import type { DetectedFace as StillFace } from '../read/face-geometry';

const fraction = z.number().finite().min(0).max(1);
const nativeFace = z.object({
  x: fraction, y: fraction,
  width: fraction.positive(), height: fraction.positive(),
  yawAngle: z.number().finite(), rollAngle: z.number().finite(),
}).refine(f => f.x + f.width <= 1.000001 && f.y + f.height <= 1.000001);
const detection = z.object({
  imageWidth: z.number().finite().positive(), imageHeight: z.number().finite().positive(),
  faces: z.array(nativeFace),
});
const viewport = z.object({ width: z.number().finite().positive(), height: z.number().finite().positive() });

/** Native results are upright, normalized, top-left coordinates. No contour points are invented. */
export function visionStillFaces(raw: unknown): StillFace[] {
  const result = detection.parse(raw);
  return result.faces.map(f => ({ bounds: {
    x: f.x * result.imageWidth, y: f.y * result.imageHeight,
    width: f.width * result.imageWidth, height: f.height * result.imageHeight,
  } }));
}

/** The front-camera preview is mirrored and center-cropped with aspect-fill. */
export function visionPreviewFaces(raw: unknown, size: { width: number; height: number }): PreviewFace[] {
  const result = detection.parse(raw);
  viewport.parse(size);
  const scale = Math.max(size.width / result.imageWidth, size.height / result.imageHeight);
  const width = result.imageWidth * scale;
  const height = result.imageHeight * scale;
  return result.faces.map(f => ({
    bounds: {
      x: (1 - f.x - f.width) * width + (size.width - width) / 2,
      y: f.y * height + (size.height - height) / 2,
      width: f.width * width, height: f.height * height,
    },
    yawAngle: -f.yawAngle, rollAngle: -f.rollAngle,
  }));
}
