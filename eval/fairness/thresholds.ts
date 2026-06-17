// eval/fairness/thresholds.ts
// PROVISIONAL acceptance thresholds — owned by founders + counsel + a domain expert, NOT final.
// The harness reports numbers against these; the real pass/fail policy is set with validation data.
export const THRESHOLDS = {
  minSamplesPerFst: 30, // below this, a group's gate rate is "insufficient sample"
  minSubjectsPerFst: 10, // stability needs this many multi-capture subjects per group
  gateFloor: 0.9, // every FST group's gate pass-rate must be >= this
  gateMaxGap: 0.05, // best-worst gate pass-rate gap must be <= this
  stabilityTolerance: 0.25, // worst-group instability <= best-group * (1 + this)
  biasBound: 0.2, // |corr(FST, score)| above this is flagged
} as const;
export type Thresholds = typeof THRESHOLDS;
