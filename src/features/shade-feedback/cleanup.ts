export const FEEDBACK_CLEANUP_KEY = 'truetone.feedbackCleanupPending.v1';
type MarkerStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function createFeedbackCleanup(storage: MarkerStorage, wipe: () => Promise<void>) {
  let pending = false;
  let queue: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  function publish(value: boolean) {
    if (pending === value) return;
    pending = value;
    listeners.forEach((listener) => listener());
  }
  function attempt(force: boolean): Promise<void> {
    const next = queue.then(async () => {
      try {
        if (!force && !pending && await storage.getItem(FEEDBACK_CLEANUP_KEY) === null) return;
        publish(true);
        // Write ahead of deletion so a terminated app can safely retry on its next launch.
        try {
          await storage.setItem(FEEDBACK_CLEANUP_KEY, '1');
        } catch {
          // A bookkeeping failure must not prevent the requested deletion itself.
        }
        await wipe();
        await storage.removeItem(FEEDBACK_CLEANUP_KEY);
        publish(false);
      } catch {
        publish(true);
        throw new Error('Feedback cleanup incomplete');
      }
    });
    queue = next.catch(() => undefined);
    return next;
  }
  return {
    clear: () => attempt(true),
    retry: () => attempt(false),
    getSnapshot: () => pending,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
