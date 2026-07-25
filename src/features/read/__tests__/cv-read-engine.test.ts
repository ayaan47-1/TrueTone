import { CvReadEngine } from '../cv-read-engine';
import { solidRgb } from '../cv/fixtures';
import { renderFace } from '../../../../eval/render/face';
import { faceEllipse, syntheticContours } from '../../../../eval/render/geometry';

test('decodes, scores, and deletes the image (success path)', async () => {
  const deleted: string[] = [];
  const engine = new CvReadEngine({
    decode: async () => solidRgb(120, 120, [180, 140, 120]),
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
  const decode = async () => rendered.rgb;

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
