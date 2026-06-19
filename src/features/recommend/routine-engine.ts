import type { RecommendationDomain } from './domain';
import type { RecommendationAttrs, Routine } from './routine-types';

// Public entry point. Kept as a thin function so callers depend on the engine, not a specific domain.
export function buildRoutine(domain: RecommendationDomain, attrs: RecommendationAttrs): Routine {
  return domain.buildRoutine(attrs);
}
