import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ScoreVector } from '../../read/read-types';
import { computePersonalBaseline } from '../personal-baseline';
import { MIN_SCANS, SPREAD_FLOOR } from '../types';
import type { PersonalSnapshot } from '../types';

const vec = (v: number, overrides: Partial<ScoreVector> = {}): ScoreVector =>
  ({ ...Object.fromEntries(DIMENSIONS.map((d) => [d, v])), ...overrides }) as ScoreVector;

const snap = (
  v: number,
  overrides: Partial<ScoreVector> = {},
  isStub = false,
  captureQuality: 'good' | 'fair' | 'poor' | null = 'good',
): PersonalSnapshot => ({ scores: vec(v, overrides), isStub, captureQuality });

// history is newest-first; index 0 (the latest) is excluded from the baseline.
describe('computePersonalBaseline', () => {
  test('returns null with fewer than MIN_SCANS non-stub priors', () => {
    // latest + (MIN_SCANS - 1) priors → not enough
    const history = [snap(0.5), ...Array.from({ length: MIN_SCANS - 1 }, () => snap(0.5))];
    expect(computePersonalBaseline(history)).toBeNull();
  });

  test('returns a baseline at exactly MIN_SCANS non-stub priors', () => {
    const history = [snap(0.9), ...Array.from({ length: MIN_SCANS }, () => snap(0.5))];
    const b = computePersonalBaseline(history);
    expect(b).not.toBeNull();
    expect(b!.hydration!.center).toBeCloseTo(0.5);
  });

  test('excludes the latest scan from the baseline', () => {
    // priors all 0.4; latest 0.9 must NOT pull the center
    const history = [snap(0.9), snap(0.4), snap(0.4), snap(0.4)];
    const b = computePersonalBaseline(history)!;
    expect(b.hydration!.center).toBeCloseTo(0.4);
  });

  test('excludes stub scans from the baseline', () => {
    // only 2 non-stub priors → null even though 4 priors exist
    const history = [snap(0.5), snap(0.4), snap(0.4, {}, true), snap(0.4, {}, true), snap(0.4)];
    expect(computePersonalBaseline(history)).toBeNull();
  });

  test('excludes poor-quality-capture priors from the baseline', () => {
    // only 2 good-quality priors → null even though 4 priors exist
    const history = [
      snap(0.5), snap(0.4), snap(0.4, {}, false, 'poor'), snap(0.4, {}, false, 'poor'), snap(0.4),
    ];
    expect(computePersonalBaseline(history)).toBeNull();
  });

  test('excludes priors with an unknown (null) capture-quality band', () => {
    // pre-migration scans read back with a null band — treated as not-comparable
    const history = [
      snap(0.5), snap(0.4), snap(0.4, {}, false, null), snap(0.4, {}, false, null), snap(0.4),
    ];
    expect(computePersonalBaseline(history)).toBeNull();
  });

  test('includes fair-quality-capture priors in the baseline', () => {
    const history = [snap(0.9), snap(0.4, {}, false, 'fair'), snap(0.4), snap(0.4)];
    const b = computePersonalBaseline(history)!;
    expect(b.hydration!.center).toBeCloseTo(0.4);
  });

  test('median is robust to a single outlier prior', () => {
    const history = [snap(0.5), snap(0.4), snap(0.4), snap(0.4), snap(0.99)];
    const b = computePersonalBaseline(history)!;
    expect(b.redness!.center).toBeCloseTo(0.4); // median of [0.4, 0.4, 0.4, 0.99]
  });

  test('even-count median averages the two middle values', () => {
    const history = [snap(0.5), snap(0.2), snap(0.4), snap(0.6), snap(0.8)];
    const b = computePersonalBaseline(history)!;
    expect(b.texture!.center).toBeCloseTo(0.5); // median of [0.2, 0.4, 0.6, 0.8]
  });

  test('spread is floored at SPREAD_FLOOR for identical history', () => {
    const history = [snap(0.5), snap(0.5), snap(0.5), snap(0.5)];
    const b = computePersonalBaseline(history)!;
    expect(b.pores!.spread).toBe(SPREAD_FLOOR);
  });

  test('spread reflects MAD * 1.4826 when above the floor', () => {
    // priors: 0.1, 0.5, 0.9 → median 0.5, MAD = median(|x-0.5|) = 0.4 → spread ≈ 0.593
    const history = [snap(0.5), snap(0.1), snap(0.5), snap(0.9)];
    const b = computePersonalBaseline(history)!;
    expect(b.darkSpots!.spread).toBeCloseTo(0.4 * 1.4826, 5);
  });

  test('a dimension with NaN priors is omitted; the rest survive', () => {
    const history = [
      snap(0.5),
      snap(0.4, { hydration: Number.NaN }),
      snap(0.4, { hydration: Number.NaN }),
      snap(0.4),
    ];
    const b = computePersonalBaseline(history)!;
    expect(b.hydration).toBeUndefined(); // only 1 valid hydration prior < MIN_SCANS
    expect(b.redness).toBeDefined();
  });

  test('does not mutate the input history', () => {
    const history = [snap(0.5), snap(0.4), snap(0.3), snap(0.2)];
    const copy = JSON.parse(JSON.stringify(history));
    computePersonalBaseline(history);
    expect(history).toEqual(copy);
  });
});
