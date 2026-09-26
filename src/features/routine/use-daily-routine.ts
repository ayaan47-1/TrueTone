// src/features/routine/use-daily-routine.ts
// Account-screen hook for the user's daily routine. Loads the user-scoped log, exposes today's
// entries + a summary, and persists add/remove and one-tap publish. Renders immediately (empty
// while loading, then fills) -- no loading-null gate, matching the app's async-effect pattern.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toDateKey } from '../today/week';
import type { CommunityProfile } from '../identity/community-profile-types';
import { addProduct, emptyDay, removeProduct, summarize } from './routine-logic';
import { getRoutineLog, saveDay } from './routine-storage';
import { publishDailyRoutine } from './routine-publish';
import type { DailyRoutine, RoutineLog, RoutineSlot, RoutineSummary } from './routine-types';

export interface UseDailyRoutineResult {
  today: DailyRoutine;
  summary: RoutineSummary;
  loading: boolean;
  addToSlot: (slot: RoutineSlot, productId: string) => void;
  removeFromSlot: (slot: RoutineSlot, productId: string) => void;
  publish: (profile: CommunityProfile) => Promise<boolean>;
}

export function useDailyRoutine(userId: string | null, now: Date = new Date()): UseDailyRoutineResult {
  const todayKey = toDateKey(now);
  const [log, setLog] = useState<RoutineLog>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLog({});
      setLoading(false);
      return;
    }
    setLoading(true);
    getRoutineLog(userId)
      .then((l) => {
        if (!cancelled) setLog(l);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const today = log[todayKey] ?? emptyDay(todayKey);

  const persist = useCallback(
    (nextDay: DailyRoutine) => {
      setLog((prev) => ({ ...prev, [nextDay.date]: nextDay }));
      if (userId) void saveDay(userId, nextDay);
    },
    [userId],
  );

  const addToSlot = useCallback(
    (slot: RoutineSlot, productId: string) => persist(addProduct(today, slot, productId)),
    [persist, today],
  );

  const removeFromSlot = useCallback(
    (slot: RoutineSlot, productId: string) => persist(removeProduct(today, slot, productId)),
    [persist, today],
  );

  const publish = useCallback(
    async (profile: CommunityProfile): Promise<boolean> => {
      const result = await publishDailyRoutine(profile, today);
      return result !== null;
    },
    [today],
  );

  const summary = useMemo(() => summarize(log, now), [log, now]);

  return { today, summary, loading, addToSlot, removeFromSlot, publish };
}
