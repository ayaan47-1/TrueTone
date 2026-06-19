import type { RecommendationAttrs, Routine } from './routine-types';
export type { RecommendationAttrs, Routine, RoutineStep } from './routine-types';

export interface RecommendationDomain {
  id: string;       // 'skincare' now; 'makeup' later
  version: string;  // stamped into Routine.version + scans.routine_engine_version
  buildRoutine(attrs: RecommendationAttrs): Routine;
}
