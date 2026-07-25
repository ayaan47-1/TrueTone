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
    // Fixture note (fix-round, post-review): the original fixture here used a saturated-red patch
    // ([250,60,60], L*≈56) against floorL = baselineL(52) * (1+relLift(0.5)) = 78. Since the
    // patch's L* was already BELOW floorL, the lightness gate rejected it before the saturation
    // check (sat < satThr) ever ran — disabling saturation entirely (satThr=1.01) left the result
    // unchanged, proving the test was vacuous. This fixture uses a bright SATURATED yellow
    // ([255,255,0], L*≈97, sat=1.0) whose lightness comfortably clears floorL=78, so only the
    // saturation gate can be what excludes it.
    const base = solidRgb(96, 96, [140, 110, 95]);
    const yellow = fillRect(base, { x: 20, y: 20, w: 20, h: 20 }, [255, 255, 0]);
    expect(specularFraction(yellow, RECT, 52, 0.5, 0.15)).toBeLessThan(0.01);
  });

  it('counts a near-neutral patch at the SAME lightness the saturated patch cleared', () => {
    // Mirror of the case above: a near-white neutral patch ([247,247,247], L*≈97, sat≈0) — matched
    // in lightness to the yellow patch, so it clears the identical floorL=78 — but near-neutral
    // instead of saturated. It IS counted. Together the pair isolates saturation, not lightness,
    // as the discriminator: same floor, same lightness, opposite verdict.
    const base = solidRgb(96, 96, [140, 110, 95]);
    const brightNeutral = fillRect(base, { x: 20, y: 20, w: 20, h: 20 }, [247, 247, 247]);
    expect(specularFraction(brightNeutral, RECT, 52, 0.5, 0.15)).toBeGreaterThan(0.05);
  });
});
