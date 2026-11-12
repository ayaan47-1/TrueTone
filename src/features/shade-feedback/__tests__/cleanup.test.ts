import { createFeedbackCleanup, FEEDBACK_CLEANUP_KEY } from '../cleanup';

function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
  };
  const wipe = jest.fn(async () => {});
  return { values, storage, wipe };
}

test('failed wipe leaves only a content-free durable marker and a new instance retries it', async () => {
  const f = fixture();
  f.wipe.mockRejectedValueOnce(new Error('locked'));
  const first = createFeedbackCleanup(f.storage, f.wipe);
  await expect(first.clear()).rejects.toThrow();
  expect(first.getSnapshot()).toBe(true);
  expect([...f.values.entries()]).toEqual([[FEEDBACK_CLEANUP_KEY, '1']]);
  const restarted = createFeedbackCleanup(f.storage, f.wipe);
  await restarted.retry();
  expect(f.wipe).toHaveBeenCalledTimes(2);
  expect(restarted.getSnapshot()).toBe(false);
  expect(f.values.size).toBe(0);
});

test('clean startup never wipes new answers, pending failures stay retryable and subscribers update', async () => {
  const f = fixture();
  const cleanup = createFeedbackCleanup(f.storage, f.wipe);
  const changed = jest.fn();
  const unsubscribe = cleanup.subscribe(changed);
  await cleanup.retry();
  expect(f.wipe).not.toHaveBeenCalled();
  f.wipe.mockRejectedValueOnce(new Error('locked'));
  await expect(cleanup.clear()).rejects.toThrow();
  expect(changed).toHaveBeenCalled();
  await cleanup.retry();
  expect(cleanup.getSnapshot()).toBe(false);
  unsubscribe();
});

test('a failed marker removal cannot falsely report cleanup complete', async () => {
  const f = fixture();
  const cleanup = createFeedbackCleanup(f.storage, f.wipe);
  f.storage.removeItem.mockRejectedValueOnce(new Error('disk locked'));
  await expect(cleanup.clear()).rejects.toThrow();
  expect(cleanup.getSnapshot()).toBe(true);
  expect(f.values.get(FEEDBACK_CLEANUP_KEY)).toBe('1');
  await cleanup.retry();
  expect(cleanup.getSnapshot()).toBe(false);
});

test('concurrent startup and forced withdrawal cannot lose the forced wipe', async () => {
  const f = fixture();
  const cleanup = createFeedbackCleanup(f.storage, f.wipe);
  await Promise.all([cleanup.retry(), cleanup.clear(), cleanup.retry()]);
  expect(f.wipe).toHaveBeenCalledTimes(1);
  expect(f.values.size).toBe(0);
});

test('marker storage failure does not prevent the requested deletion', async () => {
  const f = fixture();
  const cleanup = createFeedbackCleanup(f.storage, f.wipe);
  f.storage.setItem.mockRejectedValueOnce(new Error('marker write unavailable'));
  await cleanup.clear();
  expect(f.wipe).toHaveBeenCalledTimes(1);
  expect(cleanup.getSnapshot()).toBe(false);
});

test('an unreadable marker is not treated as a successful cleanup', async () => {
  const f = fixture();
  const cleanup = createFeedbackCleanup(f.storage, f.wipe);
  f.storage.getItem.mockRejectedValueOnce(new Error('locked'));
  await expect(cleanup.retry()).rejects.toThrow('Feedback cleanup incomplete');
  expect(cleanup.getSnapshot()).toBe(true);
  await cleanup.retry();
  expect(f.wipe).toHaveBeenCalledTimes(1);
  expect(cleanup.getSnapshot()).toBe(false);
});
