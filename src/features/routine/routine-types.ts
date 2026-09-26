// src/features/routine/routine-types.ts
// Pure shapes for the on-device "My Daily Routine" tracker -- no runtime, no JSX, no network.
// The tracker records which shop-catalog products a user applied in their AM and PM routine
// each day, entirely on-device (AsyncStorage). Product ids point into the existing shop catalog
// (src/features/match/product-catalog) -- never a second product list.

export type RoutineSlot = 'am' | 'pm';

/** One day's routine: the product ids logged in each slot (order = log order, no duplicates). */
export interface DailyRoutine {
  /** Local day key, `YYYY-MM-DD` (see src/features/today/week.ts `toDateKey`). */
  date: string;
  am: readonly string[];
  pm: readonly string[];
}

/** All logged days, keyed by day. */
export type RoutineLog = Record<string, DailyRoutine>;

/** Compact figures for the For You summary widget. */
export interface RoutineSummary {
  amCount: number;
  pmCount: number;
  todayCount: number;
  /** Consecutive days ending today that have at least one product logged (0 if today is empty). */
  streak: number;
}
