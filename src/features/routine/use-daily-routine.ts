// src/features/routine/use-daily-routine.ts
// The user's daily routine (Account logger, Routine page, Home card). Loads the user-scoped log,
// exposes today's steps (carried forward from the last saved day) + a summary, and persists
// add/edit/remove and one-tap publish. Instances re-read on any save, so screens stay in sync. Renders immediately (empty
// while loading, then fills) -- no loading-null gate, matching the app's async-effect pattern.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toDateKey } from '../today/week';
import type { CommunityProfile } from '../identity/community-profile-types';
import { addProduct, computeStreak, removeProduct, replaceProduct, routineForDay } from './routine-logic';
import { getRoutineLog, saveDay, subscribeRoutine } from './routine-storage';
import { publishDailyRoutine } from './routine-publish';
import type { DailyRoutine, RoutineLog, RoutineSlot, RoutineSummary } from './routine-types';

export interface UseDailyRoutineResult {
  today: DailyRoutine;
  summary: RoutineSummary;
  loading: boolean;
  addToSlot: (slot: RoutineSlot, productId: string) => void;
  removeFromSlot: (slot: RoutineSlot, productId: string) => void;
  /** Edit a step: swap one product for another in place. */
  replaceInSlot: (slot: RoutineSlot, oldId: string, newId: string) => void;
  /** Re-read the saved log (pull to refresh). */
  reload: () => Promise<void>;
  publish: (profile: CommunityProfile) => Promise<boolean>;
}

export function useDailyRoutine(userId: string | null, now: Date = new Date()): UseDailyRoutineResult {
  const todayKey = toDateKey(now);
  const [log, setLogState] = useState<RoutineLog>({});
  const [loading, setLoading] = useState(true);
  // Latest log, so back-to-back edits build on each other rather than on a stale render.
  const logRef = useRef<RoutineLog>({});
  // Identity of this instance: its own saves are already applied, so it skips their echo.
  const self = useRef({}).current;
  const setLog = useCallback((next: RoutineLog) => {
    logRef.current = next;
    setLogState(next);
  }, []);

  const load = useCallback(async (): Promise<RoutineLog> => (userId ? getRoutineLog(userId) : {}), [userId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((l) => {
        if (!cancelled) setLog(l);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const unsubscribe = subscribeRoutine((changed, source) => {
      if (source === self || (changed !== null && changed !== userId)) return;
      void load().then((l) => {
        if (!cancelled) setLog(l);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, load, setLog, self]);

  const reload = useCallback(async () => {
    setLog(await load());
  }, [load, setLog]);

  const today = useMemo(() => routineForDay(log, todayKey), [log, todayKey]);

  /** Apply an edit to the LATEST day, show it at once, then save; a failed save reverts. */
  const edit = useCallback(
    (change: (day: DailyRoutine) => DailyRoutine) => {
      const nextDay = change(routineForDay(logRef.current, todayKey));
      setLog({ ...logRef.current, [nextDay.date]: nextDay });
      if (userId) saveDay(userId, nextDay, self).catch(() => void reload());
    },
    [userId, todayKey, self, setLog, reload],
  );

  const addToSlot = useCallback(
    (slot: RoutineSlot, productId: string) => edit((d) => addProduct(d, slot, productId)),
    [edit],
  );

  const removeFromSlot = useCallback(
    (slot: RoutineSlot, productId: string) => edit((d) => removeProduct(d, slot, productId)),
    [edit],
  );

  const replaceInSlot = useCallback(
    (slot: RoutineSlot, oldId: string, newId: string) => edit((d) => replaceProduct(d, slot, oldId, newId)),
    [edit],
  );

  const publish = useCallback(
    async (profile: CommunityProfile): Promise<boolean> => {
      const result = await publishDailyRoutine(profile, today);
      return result !== null;
    },
    [today],
  );

  const summary = useMemo<RoutineSummary>(
    () => ({
      amCount: today.am.length,
      pmCount: today.pm.length,
      todayCount: today.am.length + today.pm.length,
      streak: computeStreak(log, now),
    }),
    [today, log, now],
  );

  return { today, summary, loading, addToSlot, removeFromSlot, replaceInSlot, reload, publish };
}
