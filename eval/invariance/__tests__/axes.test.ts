import { spearman, illuminantAxis, geometricAxis, monotonicAxis, tonePreservationAxis, defectToneFairnessAxis, runAllAxes } from '../axes';
import { INVARIANCE_THRESHOLDS } from '../thresholds';
import { DIMENSIONS, type Dimension } from '../../../src/content/cosmetic-vocab';

describe('spearman', () => {
  it('is 1 for a perfectly increasing relationship', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 5);
  });
  it('is -1 for a perfectly decreasing relationship', () => {
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 5);
  });
  it('ranks rather than scales — monotone but non-linear is still 1', () => {
    expect(spearman([1, 2, 3, 4], [1, 4, 9, 16])).toBeCloseTo(1, 5);
  });
  it('is 0 when one series is constant', () => {
    expect(spearman([1, 2, 3], [5, 5, 5])).toBe(0);
  });
});

describe('axes', () => {
  it('each return a well-formed AxisResult', () => {
    for (const axis of [illuminantAxis, geometricAxis, monotonicAxis, tonePreservationAxis, defectToneFairnessAxis]) {
      const r = axis();
      expect(typeof r.name).toBe('string');
      expect(typeof r.pass).toBe('boolean');
      expect(Object.keys(r.detail).length).toBeGreaterThan(0);
    }
  });

  it('runAllAxes reports all five', () => {
    expect(runAllAxes().map((r) => r.name).sort())
      .toEqual(['defect-tone-fairness', 'geometric', 'illuminant', 'monotonic', 'tone-preservation']);
  });

  it('are deterministic — the same run twice gives the same verdicts', () => {
    expect(runAllAxes().map((r) => r.pass)).toEqual(runAllAxes().map((r) => r.pass));
  });

  it('geometric invariance passes on the current engine', () => {
    // Regions are placed proportionally off the bbox, so a uniformly scaled/translated face
    // should already score consistently. If this fails, region derivation is broken.
    expect(geometricAxis().pass).toBe(true);
  });

  it('illuminant invariance PASSES — Task 12b fixed the remaining darkSpots/redness breach', () => {
    // Task 7 made pores/fineLines/oiliness Weber-/baseline-relative (spec F3). That fix worked:
    // measured illuminant spreads dropped from {oiliness: 0.3632, pores: 0.0143, fineLines: 0.0208}
    // to {oiliness: 0.0396, pores: 0.0327, fineLines: 0.0080} — all comfortably under their
    // epsilons (oiliness/pores 0.12, fineLines 0.10).
    //
    // The axis kept reporting FAIL after Task 7 because TWO dimensions outside its scope were
    // already over their own epsilon, just invisible because oiliness's much larger breach
    // (0.3632) was picked as "worst": darkSpots (0.1115 vs 0.08 epsilon) and redness (0.0875 vs
    // 0.08 epsilon). Task 12 measured that ~92% of that breach was driven by the INTENSITY
    // (exposure) sweep, not illuminant colour — darkSpots and redness each differenced CIELAB
    // coordinates (L*, a*), which are nonlinear in luminance, so a uniform exposure gain moved
    // them even though nothing about the face changed. Task 12b (this task) replaced both with
    // ratios of LINEAR quantities that are exactly gain-invariant while staying baseline-relative
    // (darkSpots: 1 - Y/baselineY on linear relative luminance; redness: Δlog(ΣR/ΣG) on linear
    // channel sums) — see cv/dimensions/darkSpots.ts and redness.ts. Measured illuminant-axis
    // spreads after the fix: darkSpots 0.0307 (was 0.1115), redness 0.0742 (was 0.0875), both
    // under the 0.08 epsilon. The axis now passes in full.
    const r = illuminantAxis();
    expect(r.pass).toBe(true);
    expect(r.detail.darkSpots).toBeLessThan(INVARIANCE_THRESHOLDS.epsilon.darkSpots);
    expect(r.detail.redness).toBeLessThan(INVARIANCE_THRESHOLDS.epsilon.redness);
    expect(r.detail.oiliness).toBeLessThan(INVARIANCE_THRESHOLDS.epsilon.oiliness);
    expect(r.detail.pores).toBeLessThan(INVARIANCE_THRESHOLDS.epsilon.pores);
    expect(r.detail.fineLines).toBeLessThan(INVARIANCE_THRESHOLDS.epsilon.fineLines);
  });

  it('monotonic response passes — every dimension tracks its own defect', () => {
    // Was unasserted and FAILING (rho: darkSpots -0.71, redness -0.71, pores 0, texture -0.20).
    //
    // Task 14b: the sweep was raised from 5 points ([0, 0.25, 0.5, 0.75, 1]) to 11
    // ([0, 0.1, ..., 1]) specifically to defeat tie-count sensitivity. At 5 points, Spearman's
    // rho for a threshold-gated dimension is largely a function of HOW MANY exact-zero ties sit
    // at the low end of the sweep, not of the underlying curve shape — 3 ties gives exactly
    // 2/sqrt(5)=0.8944, 2 ties gives exactly 0.9747. oiliness (gated by ndh^28, the sharpest
    // specular lobe in the renderer) sat right on that artifact: rho:oiliness measured 0.9747 at
    // 5 points. At 11 points the real tie run is now visible — oiliness is exactly 0 across
    // levels 0, 0.1, 0.2, 0.3, 0.4 (raw: [0,0,0,0,0,0.0012,0.0129,0.0344,0.0813,0.1286,0.1703])
    // — and rho:oiliness drops to 0.9535. It still clears the 0.9 floor, so the underlying
    // response, while flat for the first half of the sweep, is genuinely monotonic non-decreasing
    // and the Task 7b calibration holds at the higher density. See
    // eval/reports/invariance.json for the full per-dimension rho table at 11 points.
    const r = monotonicAxis();
    expect(r.pass).toBe(true);
    expect(r.detail['rho:oiliness']).toBeGreaterThanOrEqual(INVARIANCE_THRESHOLDS.spearmanFloor);
  });

  it('tone preservation passes — normalization has not erased tone', () => {
    expect(tonePreservationAxis().pass).toBe(true);
  });

  it('defect-tone-fairness FAILS — six of eight dimensions respond unevenly across skin tone', () => {
    // Task 14c: tonePreservationAxis only ever renders at defect=0 (tone must not vanish). This
    // axis is the complement — does the SAME defect strength (0.5, see TONE_RESPONSE_DEFECT) read
    // as the SAME score on every Fitzpatrick tone? That is the actual fairness claim. Measured
    // spread (max-min across FST I..VI), full per-tone table in eval/reports/invariance.json:
    //   fineLines    0.0209  flat 0.058 -> 0.079                             PASS
    //   darkSpots    0.0334  flat 0.711 -> 0.677                             PASS
    //   texture      0.0632  flat I-V, jump at VI (0.09 -> 0.15)             FAIL
    //   hydration    0.0632  mirrors texture (drop at VI)                    FAIL
    //   redness      0.0651  rises 0.146 -> 0.211 (over-reads deep skin)     FAIL
    //   pores        0.0724  rises 0.178 -> 0.250 (over-reads deep skin)     FAIL
    //   darkCircles  0.0758  falls 0.162 -> 0.086 (under-reads deep skin)    FAIL
    //   oiliness     0.1188  U-SHAPED: I=0.071, dips near 0 at II-IV, VI=0.120  FAIL, worst overall
    //
    // The plan anticipated redness (~0.065) as the worst dimension. Measurement shows oiliness is
    // actually worse (0.1188) and non-monotonic in tone, not merely biased in one direction — a
    // real finding this task exists to surface, not paper over. toneResponseSpread=0.05 was chosen
    // from the natural >2x gap between the two clusters above (see thresholds.ts), not loosened to
    // make any known breach pass. This axis is INTENTIONALLY LEFT FAILING, same precedent as the
    // illuminant axis at the Task 6 baseline — redesigning redness/oiliness is explicitly out of
    // scope for this task (Step 4); a later task earns the flip the way Task 12b earned illuminant's.
    const r = defectToneFairnessAxis();
    expect(r.pass).toBe(false);
    expect(r.worst?.dimension).toBe('oiliness');
    expect(r.detail.darkSpots).toBeLessThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.fineLines).toBeLessThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.redness).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.pores).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.darkCircles).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.oiliness).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.texture).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.hydration).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    // Task 18: the masking bug this task fixes — six of eight dimensions breach, but the report
    // used to only ever show the single `worst` one (oiliness). `breaches` must surface all of them.
    expect(r.breaches.length).toBeGreaterThanOrEqual(6);
  });

  it('verdict-based axes report every dimension over its epsilon, not just the worst', () => {
    const tinyEpsilon = {
      ...INVARIANCE_THRESHOLDS,
      epsilon: Object.fromEntries(DIMENSIONS.map((d) => [d, 0])) as Record<Dimension, number>,
    };
    const r = illuminantAxis(tinyEpsilon);
    expect(r.pass).toBe(false);
    expect(r.breaches.length).toBe(DIMENSIONS.length);
    expect(r.breaches.map((b) => b.key)).toEqual(expect.arrayContaining(['darkSpots', 'redness', 'oiliness']));
  });
});
