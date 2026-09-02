// Pure scoring core: decoded RGB + face regions → cosmetic ScoreVector + skin type. Host-tested.
// The device wrapper (cv-read-engine.ts) supplies (rgb, regions) via face-geometry.ts's
// contour-aware derivation; this file never touches native.
import type { RgbImage, Rect, Regions } from './types';
import type { ReadResult, ScoreVector } from '../read-types';
import { deriveRegions } from './regions';
import { sampleBaseline } from './baseline';
import { redness } from './dimensions/redness';
import { darkCircles } from './dimensions/darkCircles';
import { oiliness } from './dimensions/oiliness';
import { texture } from './dimensions/texture';
import { pores } from './dimensions/pores';
import { fineLines } from './dimensions/fineLines';
import { darkSpots } from './dimensions/darkSpots';
import { hydration } from './dimensions/hydration';
import { classify } from './skin-type';

export const CV_MODEL_VERSION = 'cv-1';

export function scoreFromRgb(rgb: RgbImage, regions: Regions): ReadResult {
  const baseline = sampleBaseline(rgb, regions);
  const scores: ScoreVector = {
    hydration: hydration(rgb, regions),
    oiliness: oiliness(rgb, regions, baseline),
    texture: texture(rgb, regions),
    pores: pores(rgb, regions),
    darkSpots: darkSpots(rgb, regions, baseline),
    redness: redness(rgb, regions, baseline),
    fineLines: fineLines(rgb, regions),
    darkCircles: darkCircles(rgb, regions, baseline),
  };
  return {
    scores,
    skinType: classify(scores),
    modelVersion: CV_MODEL_VERSION,
    isStub: false,
    tone: { L: baseline.L, a: baseline.a, b: baseline.b },
  };
}

// Convenience for harnesses that have a bbox rather than regions.
export function scoreFromBbox(rgb: RgbImage, bbox: Rect): ReadResult {
  return scoreFromRgb(rgb, deriveRegions(bbox, { width: rgb.width, height: rgb.height }));
}
