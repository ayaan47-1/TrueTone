// src/features/routine/routine-logic.ts
// Pure, immutable helpers for the daily-routine tracker. No storage, no React, no network --
// every function returns a new value and never mutates its inputs.
import { toDateKey } from '../today/week';
import type { DailyRoutine, RoutineLog, RoutineSlot, RoutineSummary } from './routine-types';

export function emptyDay(date: string): DailyRoutine {
  return { date, am: [], pm: [] };
}

export function dayHasEntries(day: DailyRoutine): boolean {
  return day.am.length > 0 || day.pm.length > 0;
}

/** Add a product id to a slot, immutably; a no-op if it is already logged there. */
export function addProduct(day: DailyRoutine, slot: RoutineSlot, productId: string): DailyRoutine {
  if (day[slot].includes(productId)) return day;
  return { ...day, [slot]: [...day[slot], productId] };
}

/** Remove a product id from a slot, immutably. */
export function removeProduct(day: DailyRoutine, slot: RoutineSlot, productId: string): DailyRoutine {
  return { ...day, [slot]: day[slot].filter((id) => id !== productId) };
}

/** Step back one local day from a `YYYY-MM-DD` key. */
function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return toDateKey(date);
}

/**
 * Consecutive days, ending today, that have at least one product logged. Returns 0 when today
 * itself is empty (the streak only counts while it includes today), and stops at the first gap.
 */
export function computeStreak(log: RoutineLog, today: Date = new Date()): number {
  let key = toDateKey(today);
  let streak = 0;
  while (true) {
    const day = log[key];
    if (!day || !dayHasEntries(day)) break;
    streak += 1;
    key = previousDayKey(key);
  }
  return streak;
}

export function summarize(log: RoutineLog, today: Date = new Date()): RoutineSummary {
  const day = log[toDateKey(today)] ?? emptyDay(toDateKey(today));
  const amCount = day.am.length;
  const pmCount = day.pm.length;
  return { amCount, pmCount, todayCount: amCount + pmCount, streak: computeStreak(log, today) };
}

/**
 * Edit a step: swap `oldId` for `newId` in place, immutably, keeping step order. A no-op if
 * `oldId` is not in the slot; if `newId` is already elsewhere in the slot the old step is
 * dropped instead (a slot never holds duplicates).
 */
export function replaceProduct(
  day: DailyRoutine,
  slot: RoutineSlot,
  oldId: string,
  newId: string,
): DailyRoutine {
  if (!day[slot].includes(oldId)) return day;
  if (oldId === newId) return day;
  if (day[slot].includes(newId)) return removeProduct(day, slot, oldId);
  return { ...day, [slot]: day[slot].map((id) => (id === oldId ? newId : id)) };
}

/**
 * The routine to show for `dateKey`. A routine repeats day to day, so when that day has no
 * saved entry the most recent EARLIER day's steps carry forward (re-dated, not saved until the
 * user edits). A saved-but-empty day wins: the user cleared it on purpose.
 */
export function routineForDay(log: RoutineLog, dateKey: string): DailyRoutine {
  const saved = log[dateKey];
  if (saved) return saved;
  const earlier = Object.keys(log)
    .filter((k) => k < dateKey)
    .sort();
  const last = earlier.length > 0 ? log[earlier[earlier.length - 1]] : undefined;
  return last ? { date: dateKey, am: [...last.am], pm: [...last.pm] } : emptyDay(dateKey);
}
