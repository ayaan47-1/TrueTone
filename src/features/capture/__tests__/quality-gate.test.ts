// src/features/capture/__tests__/quality-gate.test.ts
import { evaluateQuality, type FrameMetrics } from '../quality-gate';

const ok: FrameMetrics = {
  faceDetected: true, faceCenteredness: 0.9, brightness: 0.6, sharpness: 0.8, faceFraction: 0.4,
};

test('all metrics good => allPass with a hold-still hint', () => {
  const r = evaluateQuality(ok);
  expect(r.allPass).toBe(true);
  expect(r.hint).toMatch(/hold still/i);
});
test('no face fails face and is the first hint', () => {
  const r = evaluateQuality({ ...ok, faceDetected: false });
  expect(r.face).toBe(false);
  expect(r.allPass).toBe(false);
  expect(r.hint).toMatch(/center your face/i);
});
test('too dark fails lighting with a move-into-light hint', () => {
  const r = evaluateQuality({ ...ok, brightness: 0.1 });
  expect(r.lighting).toBe(false);
  expect(r.hint).toMatch(/light/i);
});
test('face too small fails distance with move-closer', () => {
  const r = evaluateQuality({ ...ok, faceFraction: 0.1 });
  expect(r.distance).toBe(false);
  expect(r.hint).toMatch(/closer/i);
});
test('blurry fails focus', () => {
  const r = evaluateQuality({ ...ok, sharpness: 0.2 });
  expect(r.focus).toBe(false);
  expect(r.hint).toMatch(/steady/i);
});
