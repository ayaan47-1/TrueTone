import type { RecommendationDomain } from '../domain';
import type { RecommendationAttrs, Routine, RoutineStep } from '../routine-types';
import { SKINCARE_LIBRARY, SKINCARE_NOTES } from './library';
import { selectCategories } from './rules';
import type { CategoryKey } from './library';

const VERSION = 'skincare-1';

function toStep(key: CategoryKey): RoutineStep {
  const e = SKINCARE_LIBRARY[key];
  return { category: e.category, habit: e.habit, rationale: e.rationale, dimensions: [] };
}

export const skincareDomain: RecommendationDomain = {
  id: 'skincare',
  version: VERSION,
  buildRoutine(attrs: RecommendationAttrs): Routine {
    const keys = selectCategories(attrs);
    const am: RoutineStep[] = [];
    const pm: RoutineStep[] = [];
    for (const key of keys) {
      const slot = SKINCARE_LIBRARY[key].slot;
      const step = toStep(key);
      if (slot === 'am' || slot === 'both') am.push(step);
      if (slot === 'pm' || slot === 'both') pm.push(step);
    }
    const note = SKINCARE_NOTES[attrs.skinType];
    return { version: VERSION, am, pm, notes: note ? [note] : [] };
  },
};
