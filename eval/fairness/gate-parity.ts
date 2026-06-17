// eval/fairness/gate-parity.ts
import { FITZPATRICK, type Fitzpatrick } from './fst';
import type { Observation } from './types';

export interface GroupRate { pass: number; total: number; rate: number | null }
export interface GateParity {
  perFst: Record<Fitzpatrick, GroupRate>;
  bestRate: number | null;
  worstRate: number | null;
  gap: number | null;
}

export function gateParity(obs: Observation[], minSamples: number): GateParity {
  const perFst = {} as Record<Fitzpatrick, GroupRate>;
  for (const f of FITZPATRICK) {
    const group = obs.filter((o) => o.fst === f);
    const total = group.length;
    const pass = group.filter((o) => o.gate.allPass).length;
    perFst[f] = { pass, total, rate: total >= minSamples ? pass / total : null };
  }
  const rates = FITZPATRICK.map((f) => perFst[f].rate).filter((r): r is number => r !== null);
  const bestRate = rates.length ? Math.max(...rates) : null;
  const worstRate = rates.length ? Math.min(...rates) : null;
  const gap = bestRate !== null && worstRate !== null ? bestRate - worstRate : null;
  return { perFst, bestRate, worstRate, gap };
}
