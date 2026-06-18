import { facesToMetrics, ASSUMED_BRIGHTNESS, ASSUMED_SHARPNESS } from '../face-metrics';
import { evaluateQuality } from '../quality-gate';

const W = 400;
const H = 800;
// A well-framed, centered face: ~42% of frame height, centered horizontally + vertically.
const centered = { bounds: { x: 116, y: 232, width: 168, height: 336 } };

describe('facesToMetrics', () => {
  it('reports no face for an empty list', () => {
    const m = facesToMetrics([], W, H);
    expect(m.faceDetected).toBe(false);
    expect(m.faceCenteredness).toBe(0);
    expect(m.faceFraction).toBe(0);
  });

  it('guards against zero/negative window dimensions', () => {
    expect(facesToMetrics([centered], 0, H).faceDetected).toBe(false);
    expect(facesToMetrics([centered], W, -1).faceDetected).toBe(false);
  });

  it('uses neutral-pass brightness/sharpness (the detector does not measure them)', () => {
    const m = facesToMetrics([centered], W, H);
    expect(m.brightness).toBe(ASSUMED_BRIGHTNESS);
    expect(m.sharpness).toBe(ASSUMED_SHARPNESS);
  });

  it('maps a centered, well-sized face to an all-pass quality report', () => {
    const m = facesToMetrics([centered], W, H);
    expect(m.faceDetected).toBe(true);
    expect(m.faceFraction).toBeCloseTo(336 / 800, 5); // linear: height fraction
    expect(m.faceCenteredness).toBeGreaterThan(0.6);
    expect(evaluateQuality(m).allPass).toBe(true);
  });

  it('a small, far face fails the distance gate', () => {
    const far = { bounds: { x: 180, y: 360, width: 40, height: 80 } }; // height fraction 0.1
    const m = facesToMetrics([far], W, H);
    expect(m.faceDetected).toBe(true);
    const q = evaluateQuality(m);
    expect(q.distance).toBe(false);
    expect(q.hint).toMatch(/closer/i);
  });

  it('an off-center face has lower centeredness and fails the face gate', () => {
    const offset = { bounds: { x: 0, y: 0, width: 168, height: 336 } }; // top-left corner
    const m = facesToMetrics([offset], W, H);
    expect(m.faceCenteredness).toBeLessThan(0.6);
    expect(evaluateQuality(m).face).toBe(false);
  });

  it('picks the largest face when several are present', () => {
    const small = { bounds: { x: 10, y: 10, width: 30, height: 30 } };
    const m = facesToMetrics([small, centered, small], W, H);
    expect(m.faceFraction).toBeCloseTo(336 / 800, 5);
  });
});
