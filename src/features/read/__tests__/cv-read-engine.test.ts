import { CvReadEngine } from '../cv-read-engine';
import { solidRgb } from '../cv/fixtures';

test('decodes, scores, and deletes the image (success path)', async () => {
  const deleted: string[] = [];
  const engine = new CvReadEngine({
    decode: async () => solidRgb(120, 120, [180, 140, 120]),
    detect: async () => ({ x: 0, y: 0, w: 120, h: 120 }),
    del: async (uri: string) => {
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
    detect: async () => ({ x: 0, y: 0, w: 1, h: 1 }),
    del: async (uri: string) => {
      deleted.push(uri);
    },
  });

  await expect(engine.run('file:///tmp/face.jpg')).rejects.toThrow('decode boom');
  expect(deleted).toEqual(['file:///tmp/face.jpg']);
});
