import { estimateIlluminant, adaptToD65, normalizeIlluminant, flattenShading } from '../illuminant';
import { renderFace } from '../../../../../eval/render/face';
import { faceEllipse, syntheticContours } from '../../../../../eval/render/geometry';
import { regionsFromContours } from '../../face-geometry';
import { meanLab } from '../sampling';

const SIZE = { width: 256, height: 256 };
const regions = regionsFromContours(syntheticContours(faceEllipse(SIZE, { scale: 1, dx: 0, dy: 0 })), SIZE)!;
const render = (p: any) => renderFace({ size: SIZE, ...p }).rgb;

describe('estimateIlluminant', () => {
  it('is near-neutral under a D65-ish illuminant', () => {
    const g = estimateIlluminant(render({ illuminant: { tempK: 6500 } }), regions);
    expect(g[0] / g[2]).toBeCloseTo(1, 0);
  });

  it('detects a warm cast as red-heavy gains', () => {
    const g = estimateIlluminant(render({ illuminant: { tempK: 2700 } }), regions);
    expect(g[0]).toBeGreaterThan(g[2]);
  });

  it('does NOT vary with skin tone under the same light', () => {
    // The fairness requirement (spec §6b): the estimator must attribute tone to melanin, not to
    // the illuminant. Grey-World fails this catastrophically and is prohibited.
    const light = estimateIlluminant(render({ fst: 'I', illuminant: { tempK: 4000 } }), regions);
    const deep = estimateIlluminant(render({ fst: 'VI', illuminant: { tempK: 4000 } }), regions);
    expect(light[0] / light[2]).toBeCloseTo(deep[0] / deep[2], 1);
  });

  it('returns identity gains on a degenerate (black) image', () => {
    const black = { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) };
    const flat = { cheekL: { x: 0, y: 0, w: 16, h: 16 }, cheekR: { x: 16, y: 0, w: 16, h: 16 } } as any;
    expect(estimateIlluminant(black, flat)).toEqual([1, 1, 1]);
  });
});

describe('adaptToD65', () => {
  it('does not mutate its input', () => {
    const img = render({ illuminant: { tempK: 3000 } });
    const before = Array.from(img.data);
    adaptToD65(img, [1.2, 1, 0.8]);
    expect(Array.from(img.data)).toEqual(before);
  });

  it('is identity for unit gains', () => {
    const img = render({});
    expect(Array.from(adaptToD65(img, [1, 1, 1]).data)).toEqual(Array.from(img.data));
  });
});

describe('normalizeIlluminant', () => {
  it('pulls warm and cool captures of the same face closer together in chroma', () => {
    const warm = render({ illuminant: { tempK: 2700 } });
    const cool = render({ illuminant: { tempK: 7500 } });
    const chromaGap = (a: any, b: any) => {
      const la = meanLab(a, regions.cheekL);
      const lb = meanLab(b, regions.cheekL);
      return Math.hypot(la.a - lb.a, la.b - lb.b);
    };
    const before = chromaGap(warm, cool);
    const after = chromaGap(normalizeIlluminant(warm, regions), normalizeIlluminant(cool, regions));
    // KNOWN FAILURE (task 12, not weakened — see task-12-report.md): this renderer's Planckian
    // illuminant direction and its melanin direction are ~93% collinear in log-chromaticity, so the
    // melanin-orthogonal projection required for tone-fairness (spec §6b, the two tests below and
    // "does NOT vary with skin tone" above) leaves almost no correctly-signed colour-cast signal to
    // remove at this 2700K/7500K extreme, and pushes this metric slightly the wrong way (measured
    // 27.36 -> 28.82). Rotating MELANIN_DIR to force this pass was tried and rejected: it buys this
    // metric by eating into the tone axis, and empirically regressed the monotonic invariance axis.
    // Left failing and reported rather than forced.
    expect(after).toBeLessThan(before);
  });

  it('PRESERVES the lightness separation between Fitzpatrick tones', () => {
    // Invariance must never be bought by erasing tone (spec §6b).
    const l = (fst: any) => meanLab(normalizeIlluminant(render({ fst }), regions), regions.cheekL).L;
    expect(l('I') - l('VI')).toBeGreaterThan(15);
  });
});

describe('flattenShading', () => {
  it('reduces a left-right luminance gradient caused by side lighting', () => {
    const side = render({ shading: { azimuth: 0, elevation: 0.35, ambient: 0.25 } });
    const gap = (img: any) => Math.abs(meanLab(img, regions.cheekL).L - meanLab(img, regions.cheekR).L);
    expect(gap(flattenShading(side, regions))).toBeLessThan(gap(side));
  });

  it('leaves an evenly lit face essentially unchanged', () => {
    const even = render({ shading: { azimuth: 0, elevation: Math.PI / 2, ambient: 0.7 } });
    const gap = (img: any) => Math.abs(meanLab(img, regions.cheekL).L - meanLab(img, regions.cheekR).L);
    expect(Math.abs(gap(flattenShading(even, regions)) - gap(even))).toBeLessThan(2);
  });
});
