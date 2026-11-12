export const FEEDBACK_CLEANUP_KEY = 'truetone.feedbackCleanupPending.v1';
export type FeedbackConsent = 'active' | 'inactive' | 'unknown';
type MarkerStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function createFeedbackCleanup(storage: MarkerStorage, wipe: () => Promise<void>, checks: {
  readConsent(): Promise<FeedbackConsent>;
  hasFeedback(): Promise<boolean>;
}) {
  let pending = false;
  let consent: FeedbackConsent = 'unknown';
  let generation = 0;
  let queue: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  function publish(value: boolean) {
    if (pending === value) return;
    pending = value;
    listeners.forEach((listener) => listener());
  }
  function setConsent(value: FeedbackConsent) {
    if (consent === value) return;
    consent = value;
    listeners.forEach((listener) => listener());
  }
  function exclusive<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work);
    queue = next.then(() => undefined, () => undefined);
    return next;
  }
  function invalidate() {
    generation++;
    setConsent('unknown');
    return generation;
  }
  async function clearPending() {
    publish(true);
    try { await storage.setItem(FEEDBACK_CLEANUP_KEY, '1'); }
    catch { /* Deletion must not depend on storing this UI hint. */ }
    await wipe();
    await storage.removeItem(FEEDBACK_CLEANUP_KEY);
    publish(false);
  }
  async function reconcile(current: FeedbackConsent): Promise<boolean> {
    const exists = await checks.hasFeedback();
    let hint: string | null;
    try { hint = await storage.getItem(FEEDBACK_CLEANUP_KEY); }
    catch {
      if (current === 'inactive' && exists) {
        await clearPending();
        return true;
      }
      setConsent('unknown');
      publish(true);
      return false;
    }
    // Read failures and the in-memory pending flag never authorize deletion.
    if (hint === '1' || (current === 'inactive' && exists)) await clearPending();
    else publish(false);
    return true;
  }
  return {
    clear() {
      invalidate();
      return exclusive(async () => {
        setConsent('unknown');
        try { await clearPending(); }
        catch { publish(true); throw new Error('Feedback cleanup incomplete'); }
      });
    },
    retry() {
      const requested = invalidate();
      return exclusive(async () => {
        try {
          const current = await checks.readConsent().catch(() => 'unknown' as const);
          const confirmed = await reconcile(current);
          if (confirmed && requested === generation) setConsent(current);
        } catch {
          publish(true);
          throw new Error('Feedback cleanup incomplete');
        }
      });
    },
    save(work: () => Promise<void>): Promise<void> {
      const requested = generation;
      if (pending || consent !== 'active') return Promise.reject(new Error('Feedback consent not confirmed'));
      return exclusive(async () => {
        if (pending || consent !== 'active' || requested !== generation) throw new Error('Feedback consent not confirmed');
        const current = await checks.readConsent().catch(() => 'unknown' as const);
        if (requested !== generation) throw new Error('Feedback consent not confirmed');
        let confirmed: boolean;
        try { confirmed = await reconcile(current); }
        catch {
          setConsent('unknown');
          publish(true);
          throw new Error('Feedback consent not confirmed');
        }
        if (!confirmed || current !== 'active' || requested !== generation) {
          setConsent('unknown');
          throw new Error('Feedback consent not confirmed');
        }
        await work();
      });
    },
    getSnapshot: () => pending,
    canSave: () => !pending && consent === 'active',
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
