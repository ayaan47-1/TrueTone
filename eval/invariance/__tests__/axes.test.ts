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
    // Regions are derived from MLKit-shaped contours, matching the production-preferred path.
    // A uniformly scaled/translated face should score consistently through that path.
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

  it('sweeps the defect level and gates on the WORST level, not a single mid-strength one', () => {
    // A single defect level is a blind spot: a change can leave the spread at 0.5 untouched while
    // damaging fairness at 0.25 or 1.0. Measured case — excluding fully-saturated pixels held the
    // 0.5 spread at exactly 0.1188 while widening the max-defect spread from 0.20 to 0.291.
    const r = defectToneFairnessAxis();
    const LEVELS = [0, 0.1, 0.25, 0.5, 0.75, 1];
    for (const dim of ['oiliness', 'darkSpots', 'redness', 'pores', 'fineLines', 'darkCircles', 'texture', 'hydration'] as Dimension[]) {
      const perLevel = LEVELS.map((v) => r.detail[`${dim}@${v}`]);
      for (const s of perLevel) expect(typeof s).toBe('number');
      // The gating number must be the worst level, so a dimension cannot pass by being fair at
      // exactly one shine strength.
      expect(r.detail[dim]).toBeCloseTo(Math.max(...perLevel), 10);
    }
  });

  it('does not turn clean deep-tone skin into texture or lower hydration', () => {
    const r = defectToneFairnessAxis();

    expect(r.detail['texture@0']).toBeLessThanOrEqual(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail['hydration@0']).toBeLessThanOrEqual(INVARIANCE_THRESHOLDS.toneResponseSpread);
  });

  it('defect-tone-fairness FAILS — remaining dimensions still respond unevenly across skin tone', () => {
    // Re-baselined through MLKit-shaped contour regions on 2026-07-27. Pooling dark-spot hits
    // across all sampled skin area reduces its worst spread to 0.0432 without changing the 0.05
    // limit. Fine lines (0.0298), texture (0.0066), and hydration (0.0066) also pass. Redness
    // (0.1786), oiliness (0.2571), pores (0.1571), and dark circles (0.1608) remain genuine
    // failures, so the overall axis must stay red and list all four breaches.
    const r = defectToneFairnessAxis();
    expect(r.pass).toBe(false);
    expect(r.worst?.dimension).toBe('oiliness');
    expect(r.detail.darkSpots).toBeLessThanOrEqual(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.fineLines).toBeLessThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.redness).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.pores).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.darkCircles).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.oiliness).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.texture).toBeLessThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.hydration).toBeLessThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.breaches.map((breach) => breach.key).sort()).toEqual(
      ['darkCircles', 'oiliness', 'pores', 'redness'],
    );
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
