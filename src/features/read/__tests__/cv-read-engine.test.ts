import { CvReadEngine } from '../cv-read-engine';
import * as faceGeometry from '../face-geometry';
import { REGION_NAMES } from '../cv/types';
import { solidRgb } from '../cv/fixtures';
import { renderFace } from '../../../../eval/render/face';
import { faceEllipse, syntheticContours } from '../../../../eval/render/geometry';

test('decodes, scores, and deletes the image (success path)', async () => {
  const deleted: string[] = [];
  const engine = new CvReadEngine({
    decode: async () => ({ rgb: solidRgb(120, 120, [180, 140, 120]), sourceSize: { width: 120, height: 120 } }),
    detect: async () => ({ bounds: { x: 0, y: 0, width: 120, height: 120 } }),
    cleanup: async (uri: string) => {
      deleted.push(uri);
    },
  });

  const result = await engine.run('file:///tmp/face.jpg');

  expect(result.isStub).toBe(false);
  expect(result.modelVersion).toBe('cv-1');
  expect(deleted).toEqual(['file:///tmp/face.jpg']);
});

test('deletes the image even when scoring throws', async () => {
  const deleted: string[] = [];
  const engine = new CvReadEngine({
    decode: async () => {
      throw new Error('decode boom');
    },
    detect: async () => ({ bounds: { x: 0, y: 0, width: 1, height: 1 } }),
    cleanup: async (uri: string) => {
      deleted.push(uri);
    },
  });

  await expect(engine.run('file:///tmp/face.jpg')).rejects.toThrow('decode boom');
  expect(deleted).toEqual(['file:///tmp/face.jpg']);
});

describe('CvReadEngine face detection wiring', () => {
  const SIZE = { width: 256, height: 256 };
  const rendered = renderFace({ size: SIZE, defects: { spots: 0.5, oiliness: 0.4 } });
  const decode = async () => ({ rgb: rendered.rgb, sourceSize: SIZE });

  it('uses contour regions when the detector supplies them', async () => {
    const detect = jest.fn(async () => ({
      bounds: { x: rendered.bbox.x, y: rendered.bbox.y, width: rendered.bbox.w, height: rendered.bbox.h },
      contours: syntheticContours(faceEllipse(SIZE, { scale: 1, dx: 0, dy: 0 })),
    }));
    const engine = new CvReadEngine({ decode, detect, cleanup: async () => {} });
    const result = await engine.run('file://photo.jpg');
    expect(detect).toHaveBeenCalledWith('file://photo.jpg');
    expect(result.modelVersion).toBe('cv-1');
    expect(Object.values(result.scores).every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it('still produces a valid read when detection returns null', async () => {
    const engine = new CvReadEngine({ decode, detect: async () => null, cleanup: async () => {} });
    const result = await engine.run('file://photo.jpg');
    expect(Object.values(result.scores).every((v) => Number.isFinite(v))).toBe(true);
  });

  it('still produces a valid read when detection throws', async () => {
    const engine = new CvReadEngine({
      decode,
      detect: async () => { throw new Error('mlkit unavailable'); },
      cleanup: async () => {},
    });
    const result = await engine.run('file://photo.jpg');
    expect(Object.values(result.scores).every((v) => Number.isFinite(v))).toBe(true);
  });

  it('deletes the image even when detection throws', async () => {
    const cleanup = jest.fn(async () => {});
    const engine = new CvReadEngine({
      decode, cleanup,
      detect: async () => { throw new Error('boom'); },
    });
    await engine.run('file://photo.jpg');
    expect(cleanup).toHaveBeenCalled();
  });
});

// Task 16 regression: final-review CRITICAL-1. The still-image detector reports bounds in
// full-resolution SOURCE space, but scoring runs against the downscaled WORKING image. Before the
// fix, deriveRegionsForFace received the raw source-space bounds treated as if they were already
// in working-image space — at a realistic capture size every region collapsed onto ~1px in the
// working image's bottom-right corner (clampRect clamps rather than errors, so this silently
// produced a plausible-looking but garbage read). This test reproduces the exact scenario and
// pins the fix: the scaled bounds handed to deriveRegionsForFace, and hence the derived regions,
// must land at the SCALED position, not the corner.
describe('CvReadEngine detector-coordinate scaling (task-16 regression)', () => {
  const SOURCE_SIZE = { width: 3024, height: 4032 };
  const WORKING_SIZE = { width: 384, height: 512 };
  // Centred, plausible (aspect 0.75, area fraction ~0.157) face in the FULL source-resolution
  // space — this is what MLKit hands back from detectFacesOnStill on the original captured photo.
  const FACE_BOUNDS_SOURCE = { x: 900, y: 1200, width: 1200, height: 1600 };

  it('scales detector bounds into the working image before deriving regions', async () => {
    const regionsSpy = jest.spyOn(faceGeometry, 'deriveRegionsForFace');
    const decode = async () => ({
      rgb: solidRgb(WORKING_SIZE.width, WORKING_SIZE.height, [180, 140, 120]),
      sourceSize: SOURCE_SIZE,
    });
    const detect = async () => ({ bounds: FACE_BOUNDS_SOURCE });
    const engine = new CvReadEngine({ decode, detect, cleanup: async () => {} });

    await engine.run('file:///tmp/face.jpg');

    expect(regionsSpy).toHaveBeenCalledTimes(1);
    const [faceArg, sizeArg] = regionsSpy.mock.calls[0];
    expect(sizeArg).toEqual(WORKING_SIZE);
    // Hand-computed: scaleRect rounds x/y/w/h by 384/3024 (== 512/4032 == 1/7.875).
    expect(faceArg).toEqual({
      bounds: { x: 114, y: 152, width: 152, height: 203 },
      contours: undefined,
    });

    const { regions } = regionsSpy.mock.results[0].value;
    // Hand-computed expected regions: REGION_PROPORTIONS applied to the scaled bbox above, then
    // clamped to the 384x512 working image (see task-16-report.md for the full derivation).
    expect(regions.forehead).toEqual({ x: 152, y: 162, w: 76, h: 30 });
    expect(regions.cheekL).toEqual({ x: 137, y: 264, w: 30, h: 37 });
    expect(regions.cheekR).toEqual({ x: 213, y: 264, w: 30, h: 37 });
    expect(regions.infraorbitalL).toEqual({ x: 141, y: 243, w: 27, h: 16 });
    expect(regions.infraorbitalR).toEqual({ x: 211, y: 243, w: 27, h: 16 });
    expect(regions.periocularL).toEqual({ x: 132, y: 213, w: 30, h: 24 });
    expect(regions.periocularR).toEqual({ x: 217, y: 213, w: 30, h: 24 });
    expect(regions.tZone).toEqual({ x: 175, y: 213, w: 30, h: 91 });

    // Every region is a real, non-collapsed rect...
    for (const name of REGION_NAMES) {
      expect(regions[name].w).toBeGreaterThanOrEqual(2);
      expect(regions[name].h).toBeGreaterThanOrEqual(2);
    }
    // ...and explicitly NOT pinned to the working image's bottom-right corner, which is exactly
    // where the pre-fix unscaled-coordinate bug collapsed every region to (clampRect clamps a
    // huge out-of-range rect to a ~1px sliver hard against (rgb.width, rgb.height)).
    for (const name of REGION_NAMES) {
      const r = regions[name];
      expect(Math.abs(r.x + r.w - WORKING_SIZE.width)).toBeGreaterThan(5);
      expect(Math.abs(r.y + r.h - WORKING_SIZE.height)).toBeGreaterThan(5);
    }

    regionsSpy.mockRestore();
  });
});
