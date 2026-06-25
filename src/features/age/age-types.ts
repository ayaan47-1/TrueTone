import type { ScoreVector } from '../read/read-types';

// One scan's cosmetic scores plus when it was taken. Input to the freshness trend.
export type ScoreSnapshot = { capturedAt: string; scores: ScoreVector };

// Relative, within-user direction. Carries no population claim, so it ships without the age gate.
export type TrendDirection = 'fresher' | 'steady' | 'more-tired';

export interface SkinAgeTrend {
  direction: TrendDirection;
  delta: number; // signed, normalized aggregate change of the freshness index (latest vs baseline)
  sampleCount: number; // number of scans compared (>= 2 for a real trend)
}

// Absolute appearance-age estimate. Produced on-device; stays dark until SKIN_AGE_ABSOLUTE_ENABLED.
export interface SkinAgeEstimate {
  ageEstimate: number; // whole years, cosmetic "looks like" only
  confidence: number; // 0..1
  modelVersion: string;
}
