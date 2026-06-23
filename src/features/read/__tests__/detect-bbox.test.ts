import { approximateFaceBbox, detectFaceBbox } from '../detect-bbox';
import { solidRgb } from '../cv/fixtures';

test('approximateFaceBbox returns a centered box inside the image', () => {
  const b = approximateFaceBbox(512, 400);
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.w).toBeLessThanOrEqual(512);
  expect(b.y + b.h).toBeLessThanOrEqual(400);
  // centered: left margin ≈ right margin
  expect(Math.abs(b.x - (512 - (b.x + b.w)))).toBeLessThanOrEqual(1);
  expect(Math.abs(b.y - (400 - (b.y + b.h)))).toBeLessThanOrEqual(1);
});

test('approximateFaceBbox covers the majority of the frame', () => {
  const b = approximateFaceBbox(1000, 1000);
  expect(b.w).toBeGreaterThan(500);
  expect(b.h).toBeGreaterThan(500);
});

test('detectFaceBbox returns a bbox in the decoded image pixel space', async () => {
  const rgb = solidRgb(300, 200, [180, 140, 120]);
  const b = await detectFaceBbox(rgb);
  expect(b).toEqual(approximateFaceBbox(300, 200));
});
