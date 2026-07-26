// src/features/capture/__tests__/quality-gate.test.ts
import { evaluateQuality, qualityBand, THRESHOLDS, type FrameMetrics } from '../quality-gate';

const ok: FrameMetrics = {
  faceDetected: true, faceCenteredness: 0.9, brightness: 0.6, sharpness: 0.8, faceFraction: 0.4,
  yaw: 0, roll: 0, clipping: 0.01, cct: 5200, imbalance: 0.05,
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

const OK = {
  faceDetected: true, faceCenteredness: 0.9, brightness: 0.6, sharpness: 0.7, faceFraction: 0.4,
  yaw: 0, roll: 0, clipping: 0.01, cct: 5200, imbalance: 0.05,
};

describe('hardened quality gate', () => {
  it('passes a well-lit, straight-on face', () => {
    expect(evaluateQuality(OK).allPass).toBe(true);
  });

  it('fails on blown highlights with a glare hint', () => {
    const r = evaluateQuality({ ...OK, clipping: THRESHOLDS.clippingMax + 0.1 });
    expect(r.allPass).toBe(false);
    expect(r.hint).toMatch(/glare/i);
  });

  it('fails on an extreme colour cast', () => {
    expect(evaluateQuality({ ...OK, cct: 2000 }).allPass).toBe(false);
    expect(evaluateQuality({ ...OK, cct: 9000 }).allPass).toBe(false);
  });

  it('fails on strong side lighting', () => {
    const r = evaluateQuality({ ...OK, imbalance: THRESHOLDS.imbalanceMax + 0.2 });
    expect(r.hint).toMatch(/one side/i);
  });

  it('fails on a turned head', () => {
    const r = evaluateQuality({ ...OK, yaw: THRESHOLDS.poseMax + 10 });
    expect(r.allPass).toBe(false);
    expect(r.hint).toMatch(/straight on/i);
  });

  it('never mentions skin or any condition in a hint', () => {
    // CLAUDE.md §1: gate copy describes light and framing only.
    const banned = /acne|rosacea|eczema|dermat|lesion|blemish|skin/i;
    const cases = [
      OK,
      { ...OK, clipping: 0.9 }, { ...OK, cct: 1800 }, { ...OK, imbalance: 0.9 },
      { ...OK, yaw: 45 }, { ...OK, faceDetected: false }, { ...OK, brightness: 0.1 },
      { ...OK, sharpness: 0.1 }, { ...OK, faceFraction: 0.05 },
    ];
    for (const c of cases) expect(evaluateQuality(c).hint).not.toMatch(banned);
  });
});

describe('qualityBand', () => {
  it('is good when every check clears with margin', () => {
    expect(qualityBand(OK)).toBe('good');
  });
  it('is fair when a check passes but sits close to its threshold', () => {
    expect(qualityBand({ ...OK, clipping: THRESHOLDS.clippingMax * 0.95 })).toBe('fair');
  });
  it('is poor when a check fails outright', () => {
    expect(qualityBand({ ...OK, clipping: THRESHOLDS.clippingMax + 0.2 })).toBe('poor');
  });
});
