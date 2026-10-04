// src/features/checkout/order-history-store.ts
// On-device record of products the user has bought through checkout, so the routine editor
// can suggest them. Persisted encrypted to AsyncStorage (one device-local key) so it survives an app
// restart; nothing leaves the device. Holds catalog product ids only -- no payment data.
import { useEffect, useSyncExternalStore } from 'react';
import { encryptedStorage } from '../../lib/encrypted-storage';

export const ORDER_HISTORY_KEY = 'truetone.orderHistory.v1';

/** The slice of AsyncStorage this store needs (injectable for tests). */
export interface OrderStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface OrderHistory {
  /** Purchased product ids, most recent first, de-duplicated. */
  purchasedIds(): readonly string[];
  /** Read the stored history once (later calls reuse the first read). Never throws. */
  load(): Promise<readonly string[]>;
  /** Record one placed order's product ids and persist. Never throws. */
  record(productIds: readonly string[]): Promise<void>;
  /** Wipe memory and storage. Rejects if the device copy could not be removed. */
  clear(): Promise<void>;
  /** Listen for changes; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** Stored ids, or [] for missing / corrupt data. Drops non-strings, blanks and duplicates. */
function parseIds(raw: string | null): readonly string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id !== ''))];
  } catch {
    return [];
  }
}

/** `fresh` ids first, then the rest of `older` without repeats. */
function mergeIds(fresh: readonly string[], older: readonly string[]): readonly string[] {
  const head = [...new Set(fresh)];
  return [...head, ...older.filter((id) => !head.includes(id))];
}

export function createOrderHistory(storage?: OrderStorage): OrderHistory {
  let ids: readonly string[] = [];
  let loading: Promise<readonly string[]> | null = null;
  let readOk = !storage; // false until the stored history has been read successfully
  let generation = 0; // bumped by clear() so in-flight reads/writes can't resurrect wiped ids
  // Writes run one at a time so an older write can never land after a newer one.
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((l) => l());

  const read = async (started: number): Promise<readonly string[]> => {
    try {
      const stored = parseIds(storage ? await storage.getItem(ORDER_HISTORY_KEY) : null);
      readOk = true;
      // Orders recorded while the read was in flight stay on top.
      if (started === generation) ids = mergeIds(ids, stored);
      notify();
    } catch (e) {
      // Unreadable (not corrupt) storage: show what we have and retry on the next load.
      console.warn('[orderHistory] could not read stored orders', e);
      loading = null;
    }
    return [...ids];
  };

  const load = (): Promise<readonly string[]> => {
    if (!loading) loading = read(generation);
    return loading;
  };

  const enqueue = (write: () => Promise<void>): Promise<void> => {
    const run = queue.then(write);
    queue = run.catch(() => undefined);
    return run;
  };

  const record = async (productIds: readonly string[]): Promise<void> => {
    const started = generation;
    ids = mergeIds(productIds, ids);
    notify();
    // Wait for the stored history so this write includes it rather than replacing it.
    await load();
    // Skip the write if the stored history couldn't be read (it would be overwritten) or was
    // wiped meanwhile; the order stays in memory and the next order retries.
    if (!storage || !readOk || started !== generation) return;
    await enqueue(() => storage.setItem(ORDER_HISTORY_KEY, JSON.stringify(ids))).catch((e: unknown) =>
      console.warn('[orderHistory] could not save orders', e),
    );
  };

  /** Wipe memory and storage. Rejects if the device copy could not be removed. */
  const clear = async (): Promise<void> => {
    ids = [];
    generation += 1;
    loading = Promise.resolve([]);
    readOk = true;
    notify();
    if (storage) await enqueue(() => storage.removeItem(ORDER_HISTORY_KEY));
  };

  return {
    purchasedIds: () => [...ids],
    load,
    record,
    clear,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const orderHistory = createOrderHistory(encryptedStorage);

// A stable snapshot per change, as useSyncExternalStore requires.
let snapshot: readonly string[] = orderHistory.purchasedIds();
orderHistory.subscribe(() => {
  snapshot = orderHistory.purchasedIds();
});

/** Purchased ids for UI; loads the stored history on first use and re-renders on change. */
export function usePurchasedIds(): readonly string[] {
  useEffect(() => {
    void orderHistory.load();
  }, []);
  return useSyncExternalStore(orderHistory.subscribe, () => snapshot);
}
