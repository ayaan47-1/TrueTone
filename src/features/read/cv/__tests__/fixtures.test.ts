import { solidRgb, fillRect, addNoise, vStripes } from '../fixtures';

const BASE: [number, number, number] = [180, 140, 120];

test('solidRgb fills every pixel with the colour and opaque alpha', () => {
  const img = solidRgb(2, 2, BASE);
  expect(img.data).toHaveLength(2 * 2 * 4);
  expect([img.data[0], img.data[1], img.data[2], img.data[3]]).toEqual([180, 140, 120, 255]);
});

test('fillRect returns a new image and paints only the rect', () => {
  const img = solidRgb(4, 4, BASE);
  const out = fillRect(img, { x: 1, y: 1, w: 2, h: 2 }, [10, 20, 30]);
  expect(out).not.toBe(img);
  expect(img.data[0]).toBe(180); // original untouched
  const inside = (1 * 4 + 1) * 4;
  expect([out.data[inside], out.data[inside + 1], out.data[inside + 2]]).toEqual([10, 20, 30]);
  expect(out.data[0]).toBe(180); // pixel (0,0) outside the rect
});

test('addNoise is deterministic for a fixed seed', () => {
  const img = solidRgb(8, 8, BASE);
  const a = addNoise(img, { x: 0, y: 0, w: 8, h: 8 }, 20, 7);
  const b = addNoise(img, { x: 0, y: 0, w: 8, h: 8 }, 20, 7);
  expect(Array.from(a.data)).toEqual(Array.from(b.data));
});
