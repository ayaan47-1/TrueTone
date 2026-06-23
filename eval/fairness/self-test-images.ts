// Synthetic faces for the fairness self-test. The SAME blemishes are painted on every tone;
// only the baseline skin colour changes per Fitzpatrick group. If the CV read is tone-fair,
// the scores must be (near) identical across groups — that is what the bias axis checks.
import { solidRgb, fillRect } from '../../src/features/read/cv/fixtures';
import { deriveRegions } from '../../src/features/read/cv/regions';
import type { RgbImage, Rect } from '../../src/features/read/cv/types';
import type { ManifestEntry } from './manifest';

const SIZE = { width: 120, height: 120 };
const BBOX: Rect = { x: 0, y: 0, w: 120, h: 120 };

// Representative sRGB skin tones for Fitzpatrick I..VI (light → deep), descending luminance.
const TONE: Record<ManifestEntry['fst'], [number, number, number]> = {
  I: [235, 205, 188],
  II: [222, 188, 165],
  III: [198, 158, 130],
  IV: [165, 122, 95],
  V: [120, 84, 64],
  VI: [82, 57, 44],
};

// A blemish must be a tone-EQUIVALENT injury: the same FRACTIONAL darkening of the underlying
// skin, not a fixed RGB offset. A fixed offset is a different relative change on each tone and
// would itself create the very bias this self-test checks for. We scale each channel by a fixed
// factor, so the relative skin change is identical across all six tones.
const SPOT_FACTOR = 0.6; // a clear, dark forehead spot — 40% darker than the surrounding skin
const scale = ([r, g, b]: [number, number, number], f: number): [number, number, number] => [
  Math.round(r * f),
  Math.round(g * f),
  Math.round(b * f),
];

export function renderSelfTestFace(fst: ManifestEntry['fst']): { rgb: RgbImage; bbox: Rect } {
  const regions = deriveRegions(BBOX, SIZE);
  let rgb = solidRgb(120, 120, TONE[fst]);
  // A single tone-equivalent forehead spot exercises the two tone-sensitive dimensions (texture
  // via its edges, darkSpots via its darkness). All other dimensions read flat (and so are
  // trivially tone-invariant) on this synthetic face.
  rgb = fillRect(
    rgb,
    { x: regions.forehead.x + 2, y: regions.forehead.y + 2, w: 6, h: 6 },
    scale(TONE[fst], SPOT_FACTOR),
  );
  return { rgb, bbox: BBOX };
}
