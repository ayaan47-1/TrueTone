// eval/fairness/metrics.ts
import { gateParity, type GateParity } from './gate-parity';
import { stability, type StabilityResult } from './stability';
import { bias, type BiasResult } from './bias';
import { THRESHOLDS, type Thresholds } from './thresholds';
import { FITZPATRICK } from './fst';
import type { Observation } from './types';

export interface FairnessReport {
  generatedAt: string;
  totalObservations: number;
  gate: GateParity & { pass: boolean | null };
  stability: StabilityResult & { pass: boolean | null };
  bias: BiasResult & { pass: boolean };
  pass: boolean | null; // overall; null when an axis is insufficient-sample
}

// Fail-closed verdict for a per-Fitzpatrick parity axis. The asymmetry is deliberate:
//  - no evaluable groups               -> null   (insufficient sample; nothing to judge)
//  - an evaluable group already violates the criterion -> false
//      (a real disparity among the groups we DO have won't be fixed by collecting more data)
//  - criterion met but not all six FST groups are evaluable -> null
//      (fairness cannot be CERTIFIED while some skin-tone groups are missing — spec §6 "every group")
//  - criterion met AND all six groups evaluable -> true
function axisVerdict(evaluable: boolean, criterionMet: boolean, complete: boolean): boolean | null {
  if (!evaluable) return null;
  if (!criterionMet) return false;
  return complete ? true : null;
}

export function fairnessReport(
  obs: Observation[],
  generatedAt: string,
  t: Thresholds = THRESHOLDS,
): FairnessReport {
  const g = gateParity(obs, t.minSamplesPerFst);
  const gateComplete = FITZPATRICK.every((f) => g.perFst[f].rate !== null);
  const gateCriterion = g.worstRate !== null && g.gap !== null
    && g.worstRate >= t.gateFloor && g.gap <= t.gateMaxGap;
  const gatePass = axisVerdict(g.worstRate !== null, gateCriterion, gateComplete);

  const s = stability(obs, t.minSubjectsPerFst);
  const stabilityComplete = FITZPATRICK.every((f) => s.perFst[f] !== null);
  const stabilityCriterion = s.best !== null && s.worst !== null
    && s.worst <= s.best * (1 + t.stabilityTolerance);
  const stabilityPass = axisVerdict(s.worst !== null, stabilityCriterion, stabilityComplete);

  const b = bias(obs, t.biasBound);
  const biasPass = b.flagged.length === 0;

  // Fail-closed precedence: a definite FAIL on ANY axis disqualifies the whole run (a known
  // disparity is not redeemed by another axis lacking data); only with no FAIL and no insufficient
  // axis can the run PASS. bias is a global correlation (boolean, never insufficient).
  const verdicts: (boolean | null)[] = [gatePass, stabilityPass, biasPass];
  const pass = verdicts.includes(false) ? false
    : verdicts.includes(null) ? null
    : true;

  return {
    generatedAt,
    totalObservations: obs.length,
    gate: { ...g, pass: gatePass },
    stability: { ...s, pass: stabilityPass },
    bias: { ...b, pass: biasPass },
    pass,
  };
}
