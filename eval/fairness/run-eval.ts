// eval/fairness/run-eval.ts
import type { ManifestEntry } from './manifest';
import type { Observation } from './types';
import type { QualityReport } from '../../src/features/capture/quality-gate';
import type { ScoreVector } from '../../src/features/read/read-types';

// Turns one manifest entry into a gate report + scores. Fixture-fed today; the REAL extractor
// (gated on the model + counsel-approved images) decodes the image and runs the on-device read here.
export type Extractor = (entry: ManifestEntry) => Promise<{ gate: QualityReport; scores: ScoreVector }>;

export async function runEval(manifest: ManifestEntry[], extract: Extractor): Promise<Observation[]> {
  const out: Observation[] = [];
  for (const entry of manifest) {
    const { gate, scores } = await extract(entry);
    out.push({ fst: entry.fst, subjectId: entry.subjectId, gate, scores });
  }
  return out;
}
