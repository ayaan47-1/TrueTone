// Display-time personalization post-pass. Reorders/flags steps whose driving dimensions
// are unfavorably off the user's own normal. The domain's buildRoutine is untouched and
// the persisted routine stays canonical — emphasis is computed at render, never stored.
import type { Routine, RoutineStep } from './routine-types';
import type { PersonalDeviation } from '../personalize/types';

export function emphasizeRoutine(routine: Routine, deviation: PersonalDeviation): Routine {
  const isEmphasized = (step: RoutineStep): boolean =>
    step.dimensions.some((d) => deviation[d]?.favorable === false);
  const apply = (steps: RoutineStep[]): RoutineStep[] => [
    ...steps.filter(isEmphasized).map((s) => ({ ...s, emphasized: true })),
    ...steps.filter((s) => !isEmphasized(s)),
  ];
  return { ...routine, am: apply(routine.am), pm: apply(routine.pm) };
}
