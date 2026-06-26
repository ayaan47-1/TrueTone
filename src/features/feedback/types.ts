// src/features/feedback/types.ts
// "Did this help?" approved answers. Mirrors the DB check constraint in 0012_routine_feedback.sql.
export const ROUTINE_HELPFUL = ['helped', 'no_change', 'worse'] as const;
export type RoutineHelpful = (typeof ROUTINE_HELPFUL)[number];

export function isRoutineHelpful(v: unknown): v is RoutineHelpful {
  return typeof v === 'string' && (ROUTINE_HELPFUL as readonly string[]).includes(v);
}
