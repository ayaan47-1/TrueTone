import { norm01, REGION_PROPORTIONS, CAL } from '../calibration';
import { REGION_NAMES } from '../types';

test('norm01 clamps to [0,1]', () => {
  expect(norm01(5, 0, 10)).toBeCloseTo(0.5, 5);
  expect(norm01(-3, 0, 10)).toBe(0);
  expect(norm01(99, 0, 10)).toBe(1);
});

test('REGION_PROPORTIONS defines all eight regions as 4-tuples of fractions', () => {
  for (const name of REGION_NAMES) {
    const p = REGION_PROPORTIONS[name];
    expect(p).toHaveLength(4);
    for (const f of p) expect(f).toBeGreaterThanOrEqual(0);
    expect(p[0] + p[2]).toBeLessThanOrEqual(1.001); // x + w stays within the bbox
    expect(p[1] + p[3]).toBeLessThanOrEqual(1.001); // y + h stays within the bbox
  }
});

test('CAL exposes a calibration entry for every dimension', () => {
  expect(Object.keys(CAL).sort()).toEqual(
    ['darkCircles', 'darkSpots', 'fineLines', 'hydration', 'oiliness', 'pores', 'redness', 'texture'].sort(),
  );
});
