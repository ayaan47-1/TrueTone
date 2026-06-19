import type { Dimension } from '../../content/cosmetic-vocab';
import type { ScoreVector, SkinTypeFeel } from '../read/read-types';

export interface RoutineStep {
  category: string;   // approved category, e.g. "gentle hydrating cleanser"
  habit: string;      // approved habit, e.g. "use lukewarm water, pat dry"
  rationale: string;  // approved phrasing, e.g. "for the appearance of dryness"
  dimensions: Dimension[]; // which scores drove this step (audit/UX)
}

export interface Routine {
  version: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  notes: string[];
}

export interface RecommendationAttrs {
  scores: ScoreVector;
  skinType: SkinTypeFeel;
}
