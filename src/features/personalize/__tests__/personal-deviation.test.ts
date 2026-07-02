import { DIMENSIONS } from '../../../content/cosmetic-vocab';
import type { ScoreVector } from '../../read/read-types';
import { computePersonalDeviation } from '../personal-deviation';
import type { PersonalBaseline } from '../types';

const vec = (v: number, overrides: Partial<ScoreVector> = {}): ScoreVector =>
  ({ ...Object.fromEntries(DIMENSIONS.map((d) => [d, v])), ...overrides }) as ScoreVector;

// All dimensions baselined at center 0.5, spread 0.1 → z = (latest - 0.5) / 0.1.
const baseline = Object.fromEntries(
  DIMENSIONS.map((d) => [d, { center: 0.5, spread: 0.1 }]),
) as PersonalBaseline;

describe('computePersonalDeviation', () => {
  test('classifies within / above / below around Z_THRESHOLD', () => {
    // z = 1.0 exactly → NOT above (strict >); z = 1.5 → above; z = -1.5 → below
    const dev = computePersonalDeviation(
      vec(0.5, { hydration: 0.6, redness: 0.65, texture: 0.35 }),
      baseline,
    );
    expect(dev.hydration!.status).toBe('within'); // z = 1.0, not strictly above
    expect(dev.redness!.status).toBe('above');    // z = 1.5
    expect(dev.texture!.status).toBe('below');    // z = -1.5
    expect(dev.pores!.status).toBe('within');     // z = 0
  });

  test('reports the signed z value', () => {
    const dev = computePersonalDeviation(vec(0.5, { darkSpots: 0.8 }), baseline);
    expect(dev.darkSpots!.z).toBeCloseTo(3.0);
  });

  test('favorable follows FRESHNESS_POLARITY', () => {
    const dev = computePersonalDeviation(
      vec(0.5, { hydration: 0.8, redness: 0.8, fineLines: 0.2 }),
      baseline,
    );
    expect(dev.hydration!.favorable).toBe(true);  // polarity 1, above → favorable
    expect(dev.redness!.favorable).toBe(false);   // polarity -1, above → unfavorable
    expect(dev.fineLines!.favorable).toBe(true);  // polarity -1, below → favorable
  });

  test('oiliness (polarity 0) gets a status but favorable is null', () => {
    const dev = computePersonalDeviation(vec(0.5, { oiliness: 0.9 }), baseline);
    expect(dev.oiliness!.status).toBe('above');
    expect(dev.oiliness!.favorable).toBeNull();
  });

  test('within deviations have favorable null', () => {
    const dev = computePersonalDeviation(vec(0.5), baseline);
    expect(dev.hydration!.favorable).toBeNull();
  });

  test('dimensions absent from the baseline are omitted', () => {
    const partial: PersonalBaseline = { redness: { center: 0.5, spread: 0.1 } };
    const dev = computePersonalDeviation(vec(0.9), partial);
    expect(dev.redness).toBeDefined();
    expect(dev.hydration).toBeUndefined();
  });

  test('a NaN latest value omits that dimension', () => {
    const dev = computePersonalDeviation(vec(0.5, { pores: Number.NaN }), baseline);
    expect(dev.pores).toBeUndefined();
    expect(dev.redness).toBeDefined();
  });
});
