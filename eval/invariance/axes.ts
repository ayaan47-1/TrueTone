// The four fail-closed invariance axes (spec §6b). Every axis renders synthetic faces, scores them
// through the REAL engine, and reports a number against INVARIANCE_THRESHOLDS.
//
// NOT an accuracy measure. Passing means the pipeline is self-consistent and physically sensible;
// it certifies nothing about real faces and licenses no claim (CLAUDE.md §1, spec §6a).
import { renderFace } from '../render/face';
import { scoreFromBbox } from '../../src/features/read/cv/score-from-rgb';
import { DIMENSIONS, type Dimension } from '../../src/content/cosmetic-vocab';
import { FITZPATRICK } from '../fairness/fst';
import { INVARIANCE_THRESHOLDS, type InvarianceThresholds } from './thresholds';
import type { AxisBreach, AxisResult } from './types';

type Params = Parameters<typeof renderFace>[0];

function scoresFor(p: Params): Record<Dimension, number> {
  const { rgb, bbox } = renderFace(p);
  return scoreFromBbox(rgb, bbox).scores;
}

function spread(runs: Array<Record<Dimension, number>>): Record<Dimension, number> {
  return Object.fromEntries(
    DIMENSIONS.map((d) => {
      const vs = runs.map((r) => r[d]);
      return [d, Math.max(...vs) - Math.min(...vs)];
    }),
  ) as Record<Dimension, number>;
}

function verdict(name: string, spreads: Record<Dimension, number>, t: InvarianceThresholds): AxisResult {
  let worst: AxisResult['worst'] = null;
  let pass = true;
  const breaches: AxisBreach[] = [];
  for (const d of DIMENSIONS) {
    if (spreads[d] > t.epsilon[d]) {
      pass = false;
      breaches.push({ key: d, value: spreads[d], limit: t.epsilon[d] });
    }
    if (!worst || spreads[d] - t.epsilon[d] > worst.value - t.epsilon[worst.dimension]) {
      worst = { dimension: d, value: spreads[d] };
    }
  }
  return { name, pass, worst, detail: { ...spreads }, breaches };
}

export function spearman(a: number[], b: number[]): number {
  // Tie-aware ranking: equal values share the AVERAGE of the ranks they span. Without this, a
  // stable sort silently assigns strictly increasing ranks (1, 2, 3, ...) even to a fully
  // constant array, which fabricates correlation where none exists.
  const rank = (xs: number[]) => {
    const order = xs.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array(xs.length).fill(0);
    let i = 0;
    while (i < order.length) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
      const avgRank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[order[k][1]] = avgRank;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / n;
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

const TEMPS = [2700, 3500, 4500, 5500, 6500, 7500];
const INTENSITIES = [0.6, 1.0, 1.4];

export function illuminantAxis(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult {
  const defects = { spots: 0.4, redness: 0.3, oiliness: 0.4, pores: 0.4, lines: 0.3, darkCircles: 0.3, roughness: 0.3 };
  const runs = TEMPS.flatMap((tempK) =>
    INTENSITIES.map((intensity) => scoresFor({ defects, illuminant: { tempK, intensity } })),
  );
  return verdict('illuminant', spread(runs), t);
}

export function geometricAxis(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult {
  const defects = { spots: 0.4, redness: 0.3, oiliness: 0.4, pores: 0.4, lines: 0.3, darkCircles: 0.3, roughness: 0.3 };
  const geos = [
    { scale: 1.0, dx: 0, dy: 0 }, { scale: 0.85, dx: 0, dy: 0 }, { scale: 1.1, dx: 0, dy: 0 },
    { scale: 1.0, dx: 0.04, dy: 0 }, { scale: 1.0, dx: -0.04, dy: 0 }, { scale: 1.0, dx: 0, dy: 0.04 },
  ];
  return verdict('geometric', spread(geos.map((geometry) => scoresFor({ defects, geometry }))), t);
}

const DEFAULT_DEFECTS = { spots: 0, redness: 0, oiliness: 0, pores: 0, lines: 0, darkCircles: 0, roughness: 0 };
type Knob = keyof typeof DEFAULT_DEFECTS;

// Which defect parameter each dimension is supposed to track (positively).
const DEFECT_FOR: Partial<Record<Dimension, Knob>> = {
  darkSpots: 'spots', redness: 'redness', oiliness: 'oiliness',
  pores: 'pores', fineLines: 'lines', darkCircles: 'darkCircles', texture: 'roughness',
};

// Dimensions that are EXPECTED to move when a given knob is swept, and so must be excluded from
// the cross-talk check. hydration is defined as 1 - microContrast (cv/dimensions/hydration.ts),
// i.e. the inverse of texture — sweeping roughness MUST move it. Flagging that as cross-talk
// would be flagging correct behaviour.
//
// Keep this list minimal and justified: every entry is a claim that two dimensions genuinely
// share a physical cause. Adding one to silence a failing check, rather than because the coupling
// is real, quietly destroys the axis's value.
const EXPECTED_COUPLING: Partial<Record<Knob, Dimension[]>> = {
  roughness: ['hydration'],
};

export function monotonicAxis(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult {
  // 11 evenly-spaced points, not 5. At 5 points a threshold-gated detector against a sharply
  // peaked specular lobe (ndh^28 in the renderer) produces a run of exact zeros at the low end,
  // and Spearman's rho becomes a function of the TIE COUNT rather than of curve shape: 3 ties
  // gives exactly 2/sqrt(5)=0.8944, 2 ties gives exactly 0.9747 (Task 14b). Doubling the density
  // to 11 halves the weight any single tie run carries and forces rho to actually reflect whether
  // the response is monotonically increasing across the swept range.
  const levels = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const detail: Record<string, number> = {};
  let pass = true;
  let worst: AxisResult['worst'] = null;
  const breaches: AxisBreach[] = [];

  for (const [dim, knob] of Object.entries(DEFECT_FOR) as Array<[Dimension, Knob]>) {
    const runs = levels.map((v) => scoresFor({ defects: { ...DEFAULT_DEFECTS, [knob]: v } }));
    const rho = spearman(levels, runs.map((r) => r[dim]));
    detail[`rho:${dim}`] = rho;
    if (rho < t.spearmanFloor) {
      pass = false;
      breaches.push({ key: `rho:${dim}`, value: rho, limit: t.spearmanFloor });
    }
    if (!worst || rho < worst.value) worst = { dimension: dim, value: rho };

    const exempt = new Set<Dimension>([dim, ...(EXPECTED_COUPLING[knob] ?? [])]);
    for (const other of DIMENSIONS) {
      if (exempt.has(other)) continue;
      const vs = runs.map((r) => r[other]);
      const drift = Math.max(...vs) - Math.min(...vs);
      detail[`crosstalk:${knob}->${other}`] = drift;
      if (drift > t.crossTalk) {
        pass = false;
        breaches.push({ key: `crosstalk:${knob}->${other}`, value: drift, limit: t.crossTalk });
      }
    }
  }
  return { name: 'monotonic', pass, worst, detail, breaches };
}

export function tonePreservationAxis(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult {
  // Same defects, same light, sweeping tone. The MEAN SKIN LIGHTNESS must still separate the
  // tones — if normalization flattens this, "invariance" was bought by destroying signal.
  const defects = { spots: 0.4, redness: 0.3, oiliness: 0.4, pores: 0.4, lines: 0.3, darkCircles: 0.3, roughness: 0.3 };
  const lums = FITZPATRICK.map((fst) => {
    const { rgb, bbox } = renderFace({ fst, defects });
    let sum = 0, n = 0;
    for (let y = bbox.y; y < bbox.y + bbox.h; y++) {
      for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
        if (x < 0 || y < 0 || x >= rgb.width || y >= rgb.height) continue;
        const i = (y * rgb.width + x) * 4;
        sum += (0.2126 * rgb.data[i] + 0.7152 * rgb.data[i + 1] + 0.0722 * rgb.data[i + 2]) / 255;
        n++;
      }
    }
    return sum / n;
  });
  const separation = Math.max(...lums) - Math.min(...lums);
  const pass = separation >= t.tonePreservationFloor;
  return {
    name: 'tone-preservation',
    pass,
    worst: null,
    detail: { separation, ...Object.fromEntries(FITZPATRICK.map((f, i) => [`lum:${f}`, lums[i]])) },
    breaches: pass ? [] : [{ key: 'separation', value: separation, limit: t.tonePreservationFloor }],
  };
}

// Defect strengths swept by defectToneFairnessAxis. All non-zero — the existing
// tonePreservationAxis already covers defect=0 (tone must not vanish); this axis asks the
// complementary question at real defect strengths.
//
// This was a single fixed 0.5 until 2026-07-26, and that was a blind spot in the instrument: it
// measured fairness at exactly ONE shine/blemish strength, so a change could leave the reported
// number untouched while damaging fairness everywhere else. Measured case — excluding saturated
// pixels from specularFraction held the 0.5 oiliness spread at exactly 0.1188 (looking neutral)
// while pushing the max-defect spread from ~0.20 to 0.291. The axis would have called that
// harmless. Fairness that only holds at mid-strength is not fairness, so the gate is now the WORST
// level, not a representative one.
// Extended down to 0 and 0.1 on 2026-07-26: the group worst at LOW defect (darkSpots, texture,
// hydration -- a tone-dependent noise FLOOR rather than tone-dependent sensitivity) was worst at
// the bottom of the previous range, so its true worst case sat below the sweep. defect=0 is also
// the most common real condition: near-clean skin.
const TONE_RESPONSE_DEFECTS = [0, 0.1, 0.25, 0.5, 0.75, 1] as const;

export function defectToneFairnessAxis(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult {
  // The actual fairness claim: the SAME blemish, the SAME shine, the SAME redness should read as
  // the SAME score on any skin tone. tonePreservationAxis only ever renders at defect=0, so
  // nothing previously asked whether a dimension's RESPONSE to its own defect is tone-consistent —
  // this is the complement of eval/fairness's bias axis (tone alone, defect=0 there too).
  //
  // For each dimension with a defect knob (DEFECT_FOR), hold that knob at a fixed mid-strength
  // defect and sweep Fitzpatrick I..VI under identical lighting; record the spread of THAT
  // dimension's own score across tones.
  const detail: Record<string, number> = {};
  let pass = true;
  let worst: AxisResult['worst'] = null;
  const breaches: AxisBreach[] = [];

  // Records both the raw per-tone scores (so a reader can see WHICH direction tone biases the
  // response, not just its magnitude — mirrors tonePreservationAxis's lum:${fst} convention) and
  // the spread that actually gates pass/fail.
  // Records the spread at EVERY swept level (`dim@level`), the per-tone scores at the worst level
  // (`dim:FST` — so a reader sees which direction tone biases the response, and at which strength),
  // and gates on the worst level.
  const record = (dim: Dimension, byToneByLevel: number[][]): void => {
    const spreads = byToneByLevel.map((byTone) => Math.max(...byTone) - Math.min(...byTone));
    TONE_RESPONSE_DEFECTS.forEach((lvl, i) => {
      detail[`${dim}@${lvl}`] = spreads[i];
    });

    let worstIdx = 0;
    for (let i = 1; i < spreads.length; i++) if (spreads[i] > spreads[worstIdx]) worstIdx = i;
    const dimSpread = spreads[worstIdx];

    FITZPATRICK.forEach((fst, i) => {
      detail[`${dim}:${fst}`] = byToneByLevel[worstIdx][i];
    });
    // Signed per-tone values at the low-defect end too. Spread is unsigned, so it cannot say
    // WHICH tone over-reads -- and for a noise floor that direction is the product-relevant fact
    // (false positives on clean dark skin read very differently from false negatives).
    TONE_RESPONSE_DEFECTS.forEach((lvl, li) => {
      FITZPATRICK.forEach((fst, i) => {
        detail[`${dim}@${lvl}:${fst}`] = byToneByLevel[li][i];
      });
    });
    detail[dim] = dimSpread;
    detail[`${dim}@worstLevel`] = TONE_RESPONSE_DEFECTS[worstIdx];

    if (dimSpread > t.toneResponseSpread) {
      pass = false;
      breaches.push({ key: dim, value: dimSpread, limit: t.toneResponseSpread });
    }
    if (!worst || dimSpread > worst.value) worst = { dimension: dim, value: dimSpread };
  };

  for (const [dim, knob] of Object.entries(DEFECT_FOR) as Array<[Dimension, Knob]>) {
    const runsByLevel = TONE_RESPONSE_DEFECTS.map((lvl) =>
      FITZPATRICK.map((fst) => scoresFor({ fst, defects: { ...DEFAULT_DEFECTS, [knob]: lvl } })),
    );
    record(dim, runsByLevel.map((runs) => runs.map((r) => r[dim])));

    // hydration has no defect knob of its own (cv/dimensions/hydration.ts defines it as
    // 1 - microContrast, the inverse of texture — see EXPECTED_COUPLING above), so it never gets
    // its own iteration of this loop. It IS fully determined by the same roughness knob that
    // drives texture, so read its cross-tone response off that same sweep rather than a separate
    // render pass.
    if (knob === 'roughness') {
      record('hydration', runsByLevel.map((runs) => runs.map((r) => r.hydration)));
    }
  }

  return { name: 'defect-tone-fairness', pass, worst, detail, breaches };
}

export function runAllAxes(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult[] {
  return [illuminantAxis(t), geometricAxis(t), monotonicAxis(t), tonePreservationAxis(t), defectToneFairnessAxis(t)];
}
