import { SKIN_REFLECTANCE, planckianRgb } from '../tone';
import { FITZPATRICK } from '../../fairness/fst';

describe('skin reflectance', () => {
  it('covers every Fitzpatrick type', () => {
    for (const f of FITZPATRICK) expect(SKIN_REFLECTANCE[f]).toHaveLength(3);
  });

  it('decreases monotonically in luminance from I to VI', () => {
    const lum = FITZPATRICK.map((f) => {
      const [r, g, b] = SKIN_REFLECTANCE[f];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    });
    for (let i = 1; i < lum.length; i++) expect(lum[i]).toBeLessThan(lum[i - 1]);
  });

  it('keeps every channel in (0, 1]', () => {
    for (const f of FITZPATRICK) {
      for (const c of SKIN_REFLECTANCE[f]) {
        expect(c).toBeGreaterThan(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });

  it('preserves the red > green > blue ordering of skin at every tone', () => {
    for (const f of FITZPATRICK) {
      const [r, g, b] = SKIN_REFLECTANCE[f];
      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
    }
  });
});

describe('planckianRgb', () => {
  it('is near-neutral at 6500K', () => {
    const [r, g, b] = planckianRgb(6500);
    expect(r).toBeCloseTo(1, 1);
    expect(g).toBeCloseTo(1, 1);
    expect(b).toBeCloseTo(1, 1);
  });

  it('is warm (red-heavy) below 6500K and cool (blue-heavy) above', () => {
    const warm = planckianRgb(2700);
    const cool = planckianRgb(9000);
    expect(warm[0] / warm[2]).toBeGreaterThan(1.5);
    expect(cool[2] / cool[0]).toBeGreaterThan(1.0);
  });
});
