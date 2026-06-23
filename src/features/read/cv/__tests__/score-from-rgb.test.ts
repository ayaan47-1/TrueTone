import { scoreFromRgb, CV_MODEL_VERSION } from '../score-from-rgb';
import { solidRgb, fillRect, addNoise } from '../fixtures';
import { deriveRegions } from '../regions';
import { DIMENSIONS, SKIN_TYPE_FEELS } from '../../../../content/cosmetic-vocab';

const SIZE = { width: 120, height: 120 };
const BBOX = { x: 0, y: 0, w: 120, h: 120 };

function composed() {
  const regions = deriveRegions(BBOX, SIZE);
  let img = solidRgb(120, 120, [180, 140, 120]);
  img = fillRect(img, regions.tZone, [215, 120, 105]); // some redness + shine
  img = addNoise(img, regions.forehead, 25, 4); // texture
  return img;
}

test('produces an in-range score for every dimension', () => {
  const result = scoreFromRgb(composed(), BBOX);
  expect(Object.keys(result.scores).sort()).toEqual([...DIMENSIONS].sort());
  for (const d of DIMENSIONS) {
    expect(result.scores[d]).toBeGreaterThanOrEqual(0);
    expect(result.scores[d]).toBeLessThanOrEqual(1);
  }
});

test('marks the read as a real CV read', () => {
  const result = scoreFromRgb(composed(), BBOX);
  expect(result.isStub).toBe(false);
  expect(result.modelVersion).toBe(CV_MODEL_VERSION);
  expect(result.modelVersion).toBe('cv-1');
  expect(SKIN_TYPE_FEELS).toContain(result.skinType);
});
