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
import type { AxisResult } from './types';

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
  for (const d of DIMENSIONS) {
    if (spreads[d] > t.epsilon[d]) pass = false;
    if (!worst || spreads[d] - t.epsilon[d] > worst.value - t.epsilon[worst.dimension]) {
      worst = { dimension: d, value: spreads[d] };
    }
  }
  return { name, pass, worst, detail: { ...spreads } };
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
  const levels = [0, 0.25, 0.5, 0.75, 1];
  const detail: Record<string, number> = {};
  let pass = true;
  let worst: AxisResult['worst'] = null;

  for (const [dim, knob] of Object.entries(DEFECT_FOR) as Array<[Dimension, Knob]>) {
    const runs = levels.map((v) => scoresFor({ defects: { ...DEFAULT_DEFECTS, [knob]: v } }));
    const rho = spearman(levels, runs.map((r) => r[dim]));
    detail[`rho:${dim}`] = rho;
    if (rho < t.spearmanFloor) pass = false;
    if (!worst || rho < worst.value) worst = { dimension: dim, value: rho };

    const exempt = new Set<Dimension>([dim, ...(EXPECTED_COUPLING[knob] ?? [])]);
    for (const other of DIMENSIONS) {
      if (exempt.has(other)) continue;
      const vs = runs.map((r) => r[other]);
      const drift = Math.max(...vs) - Math.min(...vs);
      detail[`crosstalk:${knob}->${other}`] = drift;
      if (drift > t.crossTalk) pass = false;
    }
  }
  return { name: 'monotonic', pass, worst, detail };
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
  return {
    name: 'tone-preservation',
    pass: separation >= t.tonePreservationFloor,
    worst: null,
    detail: { separation, ...Object.fromEntries(FITZPATRICK.map((f, i) => [`lum:${f}`, lums[i]])) },
  };
}

export function runAllAxes(t: InvarianceThresholds = INVARIANCE_THRESHOLDS): AxisResult[] {
  return [illuminantAxis(t), geometricAxis(t), monotonicAxis(t), tonePreservationAxis(t)];
}
