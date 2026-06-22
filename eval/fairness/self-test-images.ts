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

export function renderSelfTestFace(fst: ManifestEntry['fst']): { rgb: RgbImage; bbox: Rect } {
  const regions = deriveRegions(BBOX, SIZE);
  let rgb = solidRgb(120, 120, TONE[fst]);
  // Identical relative "issues" on every tone: a darker T-zone patch and a forehead spot,
  // each a fixed luminance drop below the tone so the deltas (not absolutes) match across tones.
  const [r, g, b] = TONE[fst];
  rgb = fillRect(rgb, regions.tZone, [r - 30, g - 20, b - 16]);
  rgb = fillRect(rgb, { x: regions.forehead.x + 2, y: regions.forehead.y + 2, w: 6, h: 6 }, [r - 35, g - 24, b - 18]);
  return { rgb, bbox: BBOX };
}
