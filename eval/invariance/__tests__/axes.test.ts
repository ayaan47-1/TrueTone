import { spearman, illuminantAxis, geometricAxis, monotonicAxis, tonePreservationAxis, runAllAxes } from '../axes';
import { INVARIANCE_THRESHOLDS } from '../thresholds';

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
    for (const axis of [illuminantAxis, geometricAxis, monotonicAxis, tonePreservationAxis]) {
      const r = axis();
      expect(typeof r.name).toBe('string');
      expect(typeof r.pass).toBe('boolean');
      expect(Object.keys(r.detail).length).toBeGreaterThan(0);
    }
  });

  it('runAllAxes reports all four', () => {
    expect(runAllAxes().map((r) => r.name).sort())
      .toEqual(['geometric', 'illuminant', 'monotonic', 'tone-preservation']);
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
    const r = monotonicAxis();
    expect(r.pass).toBe(true);
  });

  it('tone preservation passes — normalization has not erased tone', () => {
    expect(tonePreservationAxis().pass).toBe(true);
  });
});
