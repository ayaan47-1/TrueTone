import { solidRgb, addNoise, vStripes, fillRect } from '../fixtures';
import { relativeContrastDensity, relativeGradientEnergy, specularFraction } from '../sampling';

const RECT = { x: 10, y: 10, w: 60, h: 60 };
const scaleImg = (img: any, k: number) => ({
  width: img.width, height: img.height,
  data: new Uint8ClampedArray(Array.from(img.data).map((v: any, i) => (i % 4 === 3 ? v : v * k))),
});

describe('relativeContrastDensity', () => {
  it('is invariant to a uniform exposure change', () => {
    const dim = addNoise(solidRgb(96, 96, [90, 70, 60]), RECT, 8, 3);
    const bright = scaleImg(dim, 1.8);
    expect(relativeContrastDensity(bright, RECT, 0.06))
      .toBeCloseTo(relativeContrastDensity(dim, RECT, 0.06), 1);
  });

  it('rises with texture amplitude', () => {
    const flat = addNoise(solidRgb(96, 96, [160, 130, 110]), RECT, 2, 1);
    const rough = addNoise(solidRgb(96, 96, [160, 130, 110]), RECT, 20, 1);
    expect(relativeContrastDensity(rough, RECT, 0.06))
      .toBeGreaterThan(relativeContrastDensity(flat, RECT, 0.06));
  });

  it('is near-identical on a deep tone and a light tone with the same relative texture', () => {
    // The fairness fix (spec F3): absolute thresholds under-detect on deep skin.
    const light = addNoise(solidRgb(96, 96, [220, 190, 170]), RECT, 16, 5);
    const deep = scaleImg(light, 0.35);
    expect(relativeContrastDensity(deep, RECT, 0.06))
      .toBeCloseTo(relativeContrastDensity(light, RECT, 0.06), 1);
  });
});

describe('relativeGradientEnergy', () => {
  it('is invariant to a uniform exposure change', () => {
    const dim = vStripes(solidRgb(96, 96, [100, 80, 70]), RECT, 12);
    expect(relativeGradientEnergy(scaleImg(dim, 1.7), RECT))
      .toBeCloseTo(relativeGradientEnergy(dim, RECT), 1);
  });

  it('rises with stripe depth', () => {
    const shallow = vStripes(solidRgb(96, 96, [160, 130, 110]), RECT, 4);
    const deep = vStripes(solidRgb(96, 96, [160, 130, 110]), RECT, 30);
    expect(relativeGradientEnergy(deep, RECT)).toBeGreaterThan(relativeGradientEnergy(shallow, RECT));
  });
});

describe('specularFraction', () => {
  it('detects highlights on a dark face that an absolute 0.8 luma threshold would miss', () => {
    const base = solidRgb(96, 96, [60, 45, 38]);            // deep tone, dim exposure
    const withGlare = fillRect(base, { x: 20, y: 20, w: 20, h: 20 }, [150, 148, 146]);
    // baseline L* of the dark skin is low; the patch is a large RELATIVE lift and near-neutral.
    expect(specularFraction(withGlare, RECT, 22, 0.5, 0.15)).toBeGreaterThan(0.05);
  });

  it('is ~0 on an evenly lit face with no highlights', () => {
    expect(specularFraction(solidRgb(96, 96, [160, 130, 110]), RECT, 58, 0.5, 0.15)).toBeLessThan(0.01);
  });

  it('ignores bright but SATURATED regions (coloured, not specular)', () => {
    const base = solidRgb(96, 96, [140, 110, 95]);
    const red = fillRect(base, { x: 20, y: 20, w: 20, h: 20 }, [250, 60, 60]);
    expect(specularFraction(red, RECT, 52, 0.5, 0.15)).toBeLessThan(0.01);
  });
});
