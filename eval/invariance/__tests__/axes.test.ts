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

  it('defect-tone-fairness FAILS — seven of eight dimensions respond unevenly across skin tone', () => {
    // Task 14c: tonePreservationAxis only ever renders at defect=0 (tone must not vanish). This
    // axis is the complement — does the SAME defect strength (see TONE_RESPONSE_DEFECTS) read
    // as the SAME score on every Fitzpatrick tone? That is the actual fairness claim. Measured
    // spread (max-min across FST I..VI), full per-tone table in eval/reports/invariance.json:
    // RE-BASELINED 2026-07-26: the axis used to sweep the single level 0.5, which was a blind spot.
    // It now sweeps {0.25, 0.5, 0.75, 1.0} and gates on the WORST level. Spread per level:
    //
    //   dim          @0.25   @0.5    @0.75   @1.0    MAX     worst-at
    //   fineLines    0.0215  0.0209  0.0224  0.0248  0.0248  1.00   PASS  (only genuine pass)
    //   darkSpots    0.0530  0.0334  0.0223  0.0216  0.0530  0.25   FAIL  <- passed at 0.5 ONLY
    //   texture      0.0739  0.0632  0.0615  0.0594  0.0739  0.25   FAIL
    //   hydration    0.0739  0.0632  0.0615  0.0594  0.0739  0.25   FAIL
    //   darkCircles  0.0361  0.0758  0.1200  0.1660  0.1660  1.00   FAIL
    //   pores        0.0306  0.0724  0.1082  0.1704  0.1704  1.00   FAIL
    //   redness      0.0165  0.0651  0.1197  0.1744  0.1744  1.00   FAIL
    //   oiliness     0.0296  0.1188  0.1885  0.2035  0.2035  1.00   FAIL, worst overall
    //
    // Two structurally different failure shapes, which the single-level axis could not distinguish:
    //   - worst at HIGH defect (oiliness, redness, pores, darkCircles): tone-dependent SENSITIVITY,
    //     so the gap widens as the defect grows.
    //   - worst at LOW defect (darkSpots, texture, hydration): a tone-dependent FLOOR, which
    //     dominates when the true signal is small and is swamped once it is large.
    //
    // darkSpots is the headline correction: it read 0.0334 at 0.5 and was recorded as PASSING.
    // At 0.25 it is 0.0530, over the limit. That pass was an artefact of sampling one strength.
    // SEVEN of eight dimensions now fail, not six.
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
    // Was toBeLessThan until the multi-level sweep landed. NOT a loosened bound — the limit is
    // untouched at 0.05; the measurement got honest and darkSpots stopped clearing it.
    expect(r.detail.darkSpots).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.fineLines).toBeLessThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.redness).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.pores).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.darkCircles).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.oiliness).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.texture).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    expect(r.detail.hydration).toBeGreaterThan(INVARIANCE_THRESHOLDS.toneResponseSpread);
    // Task 18: the masking bug this task fixes — the report used to only ever show the single
    // `worst` dimension (oiliness). `breaches` must surface all of them. Seven since the
    // multi-level sweep exposed darkSpots.
    expect(r.breaches.length).toBeGreaterThanOrEqual(7);
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
