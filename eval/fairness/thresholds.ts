// eval/fairness/thresholds.ts
// PROVISIONAL acceptance thresholds — owned by founders + counsel + a domain expert, NOT final.
// The harness reports numbers against these; the real pass/fail policy is set with validation data.
export const THRESHOLDS = {
  minSamplesPerFst: 30, // below this, a group's gate rate is "insufficient sample"
  minSubjectsPerFst: 10, // stability needs this many multi-capture subjects per group
  gateFloor: 0.9, // every FST group's gate pass-rate must be >= this
  gateMaxGap: 0.05, // best-worst gate pass-rate gap must be <= this
  stabilityTolerance: 0.25, // worst-group instability <= best-group * (1 + this)
  biasBound: 0.2, // |corr(FST, score)| above this is flagged...
  biasEffectFloor: 0.02, // ...but only when cross-tone score spread also exceeds this (practical
  // significance). Below this, a high correlation is float/quantization noise, not a real bias.
} as const;

// Widened to number so test fixtures can supply different values without literal-type errors.
export type Thresholds = {
  minSamplesPerFst: number;
  minSubjectsPerFst: number;
  gateFloor: number;
  gateMaxGap: number;
  stabilityTolerance: number;
  biasBound: number;
  biasEffectFloor: number;
};
