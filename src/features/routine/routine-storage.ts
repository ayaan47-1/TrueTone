// src/features/routine/routine-storage.ts
// On-device, USER-SCOPED persistence for the daily-routine tracker. One AsyncStorage key per
// user holds a { dateKey: DailyRoutine } map -- never synced to a server in v0. `clearRoutine`
// is exported so data-rights "delete everything" can wipe it alongside the diary.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailyRoutine, RoutineLog } from './routine-types';

const KEY_PREFIX = 'truetone.routine.';
const KEY_SUFFIX = '.v1';

export function routineKey(userId: string): string {
  return `${KEY_PREFIX}${userId}${KEY_SUFFIX}`;
}

export async function getRoutineLog(userId: string): Promise<RoutineLog> {
  try {
    const raw = await AsyncStorage.getItem(routineKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as RoutineLog;
  } catch {
    // Corrupt or unreadable storage -- fail safe to an empty log.
    return {};
  }
}

/** Merge one day's routine into the user's log (immutably) and persist. Returns the new log. */
export async function saveDay(userId: string, day: DailyRoutine): Promise<RoutineLog> {
  const log = await getRoutineLog(userId);
  const next: RoutineLog = { ...log, [day.date]: day };
  await AsyncStorage.setItem(routineKey(userId), JSON.stringify(next));
  return next;
}

export async function clearRoutine(userId: string): Promise<void> {
  await AsyncStorage.removeItem(routineKey(userId));
}

/**
 * Remove every user's routine log. Used by data-rights "delete everything", which has no userId
 * in scope; scans all keys with the routine prefix so it needs no provider.
 */
export async function clearAllRoutines(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const routineKeys = keys.filter((k) => k.startsWith(KEY_PREFIX) && k.endsWith(KEY_SUFFIX));
  if (routineKeys.length > 0) await AsyncStorage.multiRemove(routineKeys);
}
