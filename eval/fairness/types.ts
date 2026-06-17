// eval/fairness/types.ts
import type { Fitzpatrick } from './fst';
import type { QualityReport } from '../../src/features/capture/quality-gate';
import type { ScoreVector } from '../../src/features/read/read-types';

// One labeled, evaluated image. The metrics consume arrays of these.
export interface Observation {
  fst: Fitzpatrick;
  subjectId: string;
  gate: QualityReport;
  scores: ScoreVector;
}
