// Face bounding box for the on-device read, in pixel coordinates of the DECODED working image.
//
// v1 is an APPROXIMATION, not a detector: the capture quality gate already guarantees a centered,
// well-sized face (faceCenteredness >= 0.6, faceFraction in [0.2, 0.6]) before a photo is taken, so
// a centered box over the middle of the working image is a reasonable first bbox. It needs no new
// face-detection vendor (CLAUDE.md §6) and is fully pure/host-testable.
//
// Fallback only. The read now detects on the captured still via detect-faces-still.ts
// (spec §3a, founder-approved 2026-07-25); this centered approximation is what the fallback
// chain in face-geometry.ts lands on when no face is detected at all.
import type { Rect, RgbImage } from './cv/types';

const FACE_W_FRACTION = 0.7; // approximate share of the frame width a framed selfie face occupies
const FACE_H_FRACTION = 0.85; // ...and height

export function approximateFaceBbox(width: number, height: number): Rect {
  const w = Math.max(1, Math.round(width * FACE_W_FRACTION));
  const h = Math.max(1, Math.round(height * FACE_H_FRACTION));
  return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w, h };
}

// Pure: no native dependency in v1. Takes the decoded image so the bbox is in its pixel space.
export async function detectFaceBbox(rgb: RgbImage): Promise<Rect> {
  return approximateFaceBbox(rgb.width, rgb.height);
}
