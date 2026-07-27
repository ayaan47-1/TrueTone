// src/features/capture/__tests__/quality-gate.test.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { evaluateQuality, qualityBand, THRESHOLDS, type FrameMetrics } from '../quality-gate';

const SOURCE = readFileSync(join(__dirname, '..', 'quality-gate.ts'), 'utf8');

// Every hint literal the module can produce, extracted from the hint-priority block only (not the
// 'good' | 'fair' | 'poor' band literals elsewhere in the file). Used below to prove the banned-word
// test is exhaustive over every reachable branch, not a sample — a new branch/hint that isn't added
// to CASES will make the completeness assertion fail instead of silently going unchecked.
function extractHintLiterals(source: string): string[] {
  const start = source.indexOf('let hint =');
  const end = source.indexOf('return { face, lighting');
  const block = source.slice(start, end);
  const matches = [...block.matchAll(/'([^']*)'|"([^"]*)"/g)];
  return matches.map((m) => (m[1] ?? m[2]) as string);
}

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

  // One case per reachable hint-producing branch in evaluateQuality's priority chain, each
  // isolating exactly one failing check so the branch under test is unambiguous. The completeness
  // test below proves this list is exhaustive (not a sample) by cross-checking it against every
  // hint literal that actually exists in the module source.
  const BRANCH_CASES: ReadonlyArray<{ name: string; metrics: FrameMetrics; hint: string }> = [
    { name: 'aligned pass', metrics: OK, hint: 'Looking good — hold still' },
    { name: 'no face', metrics: { ...OK, faceDetected: false }, hint: 'Center your face in the oval' },
    { name: 'turned head (yaw)', metrics: { ...OK, yaw: THRESHOLDS.poseMax + 10 }, hint: 'Face the camera straight on' },
    { name: 'blown highlights', metrics: { ...OK, clipping: THRESHOLDS.clippingMax + 0.1 }, hint: 'Too much glare — turn away from the light' },
    { name: 'too dark', metrics: { ...OK, brightness: THRESHOLDS.brightnessMin - 0.1 }, hint: 'Move into better light' },
    { name: 'too bright', metrics: { ...OK, brightness: THRESHOLDS.brightnessMax + 0.05 }, hint: 'Too bright — reduce glare' },
    { name: 'extreme colour cast', metrics: { ...OK, cct: THRESHOLDS.cctMin - 500 }, hint: 'Try more neutral light' },
    { name: 'side lighting', metrics: { ...OK, imbalance: THRESHOLDS.imbalanceMax + 0.2 }, hint: "Light's coming from one side" },
    { name: 'face too small (far)', metrics: { ...OK, faceFraction: THRESHOLDS.faceFractionMin - 0.1 }, hint: 'Move closer' },
    { name: 'face too big (close)', metrics: { ...OK, faceFraction: THRESHOLDS.faceFractionMax + 0.1 }, hint: 'Move a little farther back' },
    { name: 'blurry', metrics: { ...OK, sharpness: THRESHOLDS.sharpness - 0.2 }, hint: 'Hold steady to focus' },
  ];

  it.each(BRANCH_CASES)('$name produces the expected hint with no banned term', ({ metrics, hint }) => {
    // CLAUDE.md §1: gate copy describes light and framing only.
    const banned = /acne|rosacea|eczema|dermat|lesion|blemish|skin/i;
    const r = evaluateQuality(metrics);
    expect(r.hint).toBe(hint);
    expect(r.hint).not.toMatch(banned);
  });

  it('BRANCH_CASES is exhaustive — its hints are exactly every hint literal in the module', () => {
    // Guards against a future branch being added to evaluateQuality without a matching case here
    // (and therefore without a banned-word check): if the module gains a new hint literal that
    // BRANCH_CASES never produces, this fails loudly instead of the gap going unnoticed.
    const produced = new Set(BRANCH_CASES.map((c) => c.hint));
    const declared = new Set(extractHintLiterals(SOURCE));
    expect([...produced].sort()).toEqual([...declared].sort());
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
