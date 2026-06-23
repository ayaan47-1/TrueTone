// Turns the face detector's bounding box into fixed sub-rectangles via fixed proportions.
// No landmarks in v1 (spec §2). Every rect is clamped to the image.
import type { Rect, Regions, RegionName } from './types';
import { REGION_NAMES } from './types';
import { REGION_PROPORTIONS } from './calibration';
import { clampRect } from './sampling';

export function deriveRegions(bbox: Rect, size: { width: number; height: number }): Regions {
  const mk = (name: RegionName): Rect => {
    const [fx, fy, fw, fh] = REGION_PROPORTIONS[name];
    return clampRect(
      { x: bbox.x + fx * bbox.w, y: bbox.y + fy * bbox.h, w: fw * bbox.w, h: fh * bbox.h },
      size.width,
      size.height,
    );
  };
  return Object.fromEntries(REGION_NAMES.map((name) => [name, mk(name)])) as Regions;
}
