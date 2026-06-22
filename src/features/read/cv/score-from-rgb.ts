// Pure scoring core: decoded RGB + face bbox → cosmetic ScoreVector + skin type. Host-tested.
// The device wrapper (cv-read-engine.ts) supplies (rgb, bbox); this file never touches native.
import type { RgbImage, Rect } from './types';
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

export function scoreFromRgb(rgb: RgbImage, bbox: Rect): ReadResult {
  const regions = deriveRegions(bbox, { width: rgb.width, height: rgb.height });
  const baseline = sampleBaseline(rgb, regions);
  const scores: ScoreVector = {
    hydration: hydration(rgb, regions),
    oiliness: oiliness(rgb, regions),
    texture: texture(rgb, regions),
    pores: pores(rgb, regions),
    darkSpots: darkSpots(rgb, regions, baseline),
    redness: redness(rgb, regions, baseline),
    fineLines: fineLines(rgb, regions),
    darkCircles: darkCircles(rgb, regions, baseline),
  };
  return { scores, skinType: classify(scores), modelVersion: CV_MODEL_VERSION, isStub: false };
}
