// eval/fairness/stability.ts
import { FITZPATRICK, type Fitzpatrick } from './fst';
import { DIMENSIONS } from '../../src/content/cosmetic-vocab';
import type { Observation } from './types';

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// One subject's instability = mean over dimensions of the std of that subject's repeat scores.
function subjectInstability(group: Observation[]): number {
  const perDim = DIMENSIONS.map((d) => std(group.map((o) => o.scores[d])));
  return perDim.reduce((a, b) => a + b, 0) / perDim.length;
}

export interface StabilityResult {
  perFst: Record<Fitzpatrick, number | null>; // mean subject instability; null if insufficient
  best: number | null; // lowest instability = best
  worst: number | null;
  gap: number | null;
}

export function stability(obs: Observation[], minSubjects: number): StabilityResult {
  const perFst = {} as Record<Fitzpatrick, number | null>;
  for (const f of FITZPATRICK) {
    const bySubject = new Map<string, Observation[]>();
    for (const o of obs.filter((x) => x.fst === f)) {
      bySubject.set(o.subjectId, [...(bySubject.get(o.subjectId) ?? []), o]);
    }
    const subjects = [...bySubject.values()].filter((s) => s.length >= 2); // need repeats
    perFst[f] = subjects.length >= minSubjects
      ? subjects.map(subjectInstability).reduce((a, b) => a + b, 0) / subjects.length
      : null;
  }
  const vals = FITZPATRICK.map((f) => perFst[f]).filter((v): v is number => v !== null);
  const best = vals.length ? Math.min(...vals) : null;
  const worst = vals.length ? Math.max(...vals) : null;
  const gap = best !== null && worst !== null ? worst - best : null;
  return { perFst, best, worst, gap };
}
