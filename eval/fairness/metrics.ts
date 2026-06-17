// eval/fairness/metrics.ts
import { gateParity, type GateParity } from './gate-parity';
import { stability, type StabilityResult } from './stability';
import { bias, type BiasResult } from './bias';
import { THRESHOLDS, type Thresholds } from './thresholds';
import type { Observation } from './types';

export interface FairnessReport {
  generatedAt: string;
  totalObservations: number;
  gate: GateParity & { pass: boolean | null };
  stability: StabilityResult & { pass: boolean | null };
  bias: BiasResult & { pass: boolean };
  pass: boolean | null; // overall; null when an axis is insufficient-sample
}

export function fairnessReport(
  obs: Observation[],
  generatedAt: string,
  t: Thresholds = THRESHOLDS,
): FairnessReport {
  const g = gateParity(obs, t.minSamplesPerFst);
  const gatePass = g.bestRate === null || g.worstRate === null
    ? null
    : g.worstRate >= t.gateFloor && (g.gap ?? 0) <= t.gateMaxGap;

  const s = stability(obs, t.minSubjectsPerFst);
  const stabilityPass = s.best === null || s.worst === null
    ? null
    : s.worst <= s.best * (1 + t.stabilityTolerance);

  const b = bias(obs, t.biasBound);
  const biasPass = b.flagged.length === 0;

  const pass = gatePass === null || stabilityPass === null
    ? null
    : gatePass && stabilityPass && biasPass;

  return {
    generatedAt,
    totalObservations: obs.length,
    gate: { ...g, pass: gatePass },
    stability: { ...s, pass: stabilityPass },
    bias: { ...b, pass: biasPass },
    pass,
  };
}
