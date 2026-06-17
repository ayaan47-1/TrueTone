// eval/fairness/bias.ts
import { DIMENSIONS, type Dimension } from '../../src/content/cosmetic-vocab';
import { fstIndex } from './fst';
import type { Observation } from './types';

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export interface BiasResult {
  perDimension: Record<Dimension, number>; // corr(FST index, score)
  flagged: Dimension[]; // |corr| > bound
}

export function bias(obs: Observation[], bound: number): BiasResult {
  const x = obs.map((o) => fstIndex(o.fst));
  const perDimension = {} as Record<Dimension, number>;
  const flagged: Dimension[] = [];
  for (const d of DIMENSIONS) {
    const c = pearson(x, obs.map((o) => o.scores[d]));
    perDimension[d] = c;
    if (Math.abs(c) > bound) flagged.push(d);
  }
  return { perDimension, flagged };
}
