import { deriveRegions } from '../regions';
import { REGION_NAMES } from '../types';

test('every region falls inside the image bounds', () => {
  const regions = deriveRegions({ x: 10, y: 20, w: 100, h: 120 }, { width: 200, height: 200 });
  for (const name of REGION_NAMES) {
    const r = regions[name];
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(200);
    expect(r.y + r.h).toBeLessThanOrEqual(200);
    expect(r.w).toBeGreaterThan(0);
    expect(r.h).toBeGreaterThan(0);
  }
});

test('tZone sits between the two cheeks horizontally', () => {
  const regions = deriveRegions({ x: 0, y: 0, w: 100, h: 100 }, { width: 100, height: 100 });
  expect(regions.cheekL.x).toBeLessThan(regions.tZone.x);
  expect(regions.tZone.x + regions.tZone.w).toBeLessThanOrEqual(regions.cheekR.x + 1);
});
