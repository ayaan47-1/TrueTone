import { renderFace, DEFAULT_PARAMS } from '../face';
import { lumaAt, clampRect } from '../../../src/features/read/cv/sampling';

const meanLumaOf = (rgb: any, r: any) => {
  const c = clampRect(r, rgb.width, rgb.height);
  let s = 0, n = 0;
  for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) { s += lumaAt(rgb, x, y); n++; }
  return s / n;
};

describe('renderFace', () => {
  it('produces a well-formed RGBA buffer', () => {
    const { rgb } = renderFace();
    expect(rgb.data).toHaveLength(rgb.width * rgb.height * 4);
    expect(rgb.width).toBe(DEFAULT_PARAMS.size.width);
  });

  it('is byte-identical across runs with the same seed', () => {
    const a = renderFace({ seed: 9 }).rgb.data;
    const b = renderFace({ seed: 9 }).rgb.data;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('differs when the seed changes', () => {
    const a = renderFace({ seed: 1, defects: { pores: 0.8 } }).rgb.data;
    const b = renderFace({ seed: 2, defects: { pores: 0.8 } }).rgb.data;
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('renders deeper Fitzpatrick types darker', () => {
    const bbox = renderFace().bbox;
    const light = meanLumaOf(renderFace({ fst: 'I' }).rgb, bbox);
    const deep = meanLumaOf(renderFace({ fst: 'VI' }).rgb, bbox);
    expect(deep).toBeLessThan(light);
  });

  it('makes the image warmer at low colour temperature', () => {
    const ratio = (p: any) => {
      const { rgb, bbox } = renderFace(p);
      let r = 0, b = 0;
      for (let y = bbox.y; y < bbox.y + bbox.h; y++)
        for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
          const i = (y * rgb.width + x) * 4;
          r += rgb.data[i]; b += rgb.data[i + 2];
        }
      return r / b;
    };
    expect(ratio({ illuminant: { tempK: 2700 } })).toBeGreaterThan(ratio({ illuminant: { tempK: 7000 } }));
  });

  it('brightens overall as intensity rises', () => {
    const bbox = renderFace().bbox;
    const dim = meanLumaOf(renderFace({ illuminant: { intensity: 0.6 } }).rgb, bbox);
    const bright = meanLumaOf(renderFace({ illuminant: { intensity: 1.3 } }).rgb, bbox);
    expect(bright).toBeGreaterThan(dim);
  });

  it('adds specular highlights in the T-zone as oiliness rises', () => {
    const { rgb, bbox } = renderFace({ defects: { oiliness: 0 } });
    const tz = { x: bbox.x + bbox.w * 0.4, y: bbox.y + bbox.h * 0.3, w: bbox.w * 0.2, h: bbox.h * 0.45 };
    const oily = renderFace({ defects: { oiliness: 0.9 } }).rgb;
    expect(meanLumaOf(oily, tz)).toBeGreaterThan(meanLumaOf(rgb, tz));
  });

  it('darkens the infraorbital band as darkCircles rises', () => {
    const { bbox } = renderFace();
    const band = { x: bbox.x + bbox.w * 0.18, y: bbox.y + bbox.h * 0.45, w: bbox.w * 0.18, h: bbox.h * 0.08 };
    const none = meanLumaOf(renderFace({ defects: { darkCircles: 0 } }).rgb, band);
    const heavy = meanLumaOf(renderFace({ defects: { darkCircles: 0.9 } }).rgb, band);
    expect(heavy).toBeLessThan(none);
  });

  it('returns a bbox and contours consistent with the requested geometry', () => {
    const a = renderFace({ geometry: { scale: 1 } });
    const b = renderFace({ geometry: { scale: 0.6 } });
    expect(b.bbox.w).toBeLessThan(a.bbox.w);
    expect(b.contours.FACE.length).toBe(a.contours.FACE.length);
  });

  it('renders the same defects identically across every tone (no tone-coupled injury)', () => {
    // The blemish must be a FRACTIONAL change to reflectance, not a fixed RGB offset — a fixed
    // offset is a different relative change per tone and would fabricate the very bias the
    // fairness axis exists to detect (mirrors eval/fairness/self-test-images.ts).
    const rel = (fst: any) => {
      const { bbox } = renderFace();
      const clean = meanLumaOf(renderFace({ fst, defects: { spots: 0 } }).rgb, bbox);
      const spotted = meanLumaOf(renderFace({ fst, defects: { spots: 0.8 } }).rgb, bbox);
      return (clean - spotted) / clean;
    };
    expect(rel('II')).toBeCloseTo(rel('V'), 2);
  });
});
