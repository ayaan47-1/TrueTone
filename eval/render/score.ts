// Synthetic-eval adapter for the production-preferred scoring path. A rendered face is only
// admissible when its contours produce regions; silently falling back to proportional bounds
// would make the harness measure a path production does not prefer.
import {
  contourRejectionReason,
  deriveRegionsForFace,
} from '../../src/features/read/face-geometry';
import { scoreFromRgb } from '../../src/features/read/cv/score-from-rgb';
import type { Regions } from '../../src/features/read/cv/types';
import type { ReadResult } from '../../src/features/read/read-types';
import type { RenderedFace } from './face';

export const SYNTHETIC_SCORING_PROVENANCE = {
  regionSource: 'contours',
  contourFixture: 'mlkit-observed-v1',
} as const;

export interface ScoredRenderedFace extends ReadResult {
  regions: Regions;
  regionSource: 'contours';
}

export function scoreRenderedFace(rendered: RenderedFace): ScoredRenderedFace {
  const size = { width: rendered.rgb.width, height: rendered.rgb.height };
  const face = {
    bounds: {
      x: rendered.bbox.x,
      y: rendered.bbox.y,
      width: rendered.bbox.w,
      height: rendered.bbox.h,
    },
    contours: rendered.contours,
  };
  const derived = deriveRegionsForFace(face, size);

  if (derived.source !== 'contours') {
    const reason = contourRejectionReason(rendered.contours, size) ?? 'unknown rejection';
    throw new Error(`Synthetic scoring requires contour-derived regions: ${reason}`);
  }

  return {
    ...scoreFromRgb(rendered.rgb, derived.regions),
    regions: derived.regions,
    regionSource: 'contours',
  };
}
