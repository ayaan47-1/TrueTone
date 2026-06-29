import {
  sheetMaxWidth,
  clampContentWidth,
  uiScale,
  captureOvalSize,
  bloomMetrics,
} from '../use-responsive';

describe('sheetMaxWidth', () => {
  it('caps at 440 on wide screens', () => {
    expect(sheetMaxWidth(1000)).toBe(440);
  });
  it('shrinks to 92% on narrow (folded) screens', () => {
    expect(sheetMaxWidth(320)).toBeCloseTo(294.4, 1);
  });
});

describe('clampContentWidth', () => {
  it('passes through normal phone widths', () => {
    expect(clampContentWidth(390)).toBe(390);
  });
  it('clamps very wide (unfolded) screens so content stays readable', () => {
    expect(clampContentWidth(1200)).toBe(560);
  });
});

describe('uiScale', () => {
  it('is ~1 at the design baseline width', () => {
    expect(uiScale(390)).toBeCloseTo(1, 2);
  });
  it('never balloons on huge screens', () => {
    expect(uiScale(1200)).toBeLessThanOrEqual(1.15);
  });
  it('never collapses on tiny screens', () => {
    expect(uiScale(200)).toBeGreaterThanOrEqual(0.85);
  });
});

describe('captureOvalSize', () => {
  it('keeps the guide aspect ratio (~350/268) on a normal phone', () => {
    const { width, height } = captureOvalSize({ width: 390, height: 844 });
    expect(height / width).toBeCloseTo(350 / 268, 1);
    expect(width).toBeLessThan(390);
  });
  it('never exceeds ~half the screen height on a short folded screen', () => {
    const { height } = captureOvalSize({ width: 360, height: 520 });
    expect(height).toBeLessThanOrEqual(520 * 0.52 + 1);
  });
  it('preserves aspect ratio when height-clamped (back-calculates width)', () => {
    const { width, height } = captureOvalSize({ width: 360, height: 520 });
    expect(height / width).toBeCloseTo(350 / 268, 1);
  });
  it('stays bounded on a very wide unfolded screen', () => {
    const { width } = captureOvalSize({ width: 1700, height: 1900 });
    expect(width).toBeLessThanOrEqual(320);
  });
  it('returns a safe aspect-correct default when height is not yet measured', () => {
    const { width, height } = captureOvalSize({ width: 390, height: 0 });
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(height / width).toBeCloseTo(350 / 268, 1);
  });
});

describe('bloomMetrics', () => {
  it('scales bloom sizes with the largest screen dimension', () => {
    const small = bloomMetrics({ width: 360, height: 640 });
    const large = bloomMetrics({ width: 1280, height: 1400 });
    expect(large.rose).toBeGreaterThan(small.rose);
    expect(large.mist).toBeGreaterThan(large.rose);
  });
  it('computes rose as ~43% of the largest dimension', () => {
    const { rose } = bloomMetrics({ width: 390, height: 844 });
    expect(rose).toBeCloseTo(844 * 0.43, 0);
  });
  it('keys off the larger axis on a wide (unfolded) screen', () => {
    const { mist } = bloomMetrics({ width: 1400, height: 1000 });
    expect(mist).toBeCloseTo(1400 * 0.5, 0);
  });
  it('returns zero-size blooms when dimensions are zero (no crash)', () => {
    const b = bloomMetrics({ width: 0, height: 0 });
    expect(b).toEqual({ rose: 0, mauve: 0, mist: 0 });
  });
});
