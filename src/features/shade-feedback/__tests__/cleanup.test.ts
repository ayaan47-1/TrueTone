import { createFeedbackCleanup, FEEDBACK_CLEANUP_KEY } from '../cleanup';

function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
  };
  const wipe = jest.fn(async () => {});
  const checks = { readConsent: async () => 'active' as const, hasFeedback: async () => false };
  return { values, storage, wipe, checks };
}

test('failed wipe leaves only a content-free durable marker and a new instance retries it', async () => {
  const f = fixture();
  f.wipe.mockRejectedValueOnce(new Error('locked'));
  const first = createFeedbackCleanup(f.storage, f.wipe, f.checks);
  await expect(first.clear()).rejects.toThrow();
  expect(first.getSnapshot()).toBe(true);
  expect([...f.values.entries()]).toEqual([[FEEDBACK_CLEANUP_KEY, '1']]);
  const restarted = createFeedbackCleanup(f.storage, f.wipe, f.checks);
  await restarted.retry();
  expect(f.wipe).toHaveBeenCalledTimes(2);
  expect(restarted.getSnapshot()).toBe(false);
  expect(f.values.size).toBe(0);
});

test('clean startup never wipes new answers, pending failures stay retryable and subscribers update', async () => {
  const f = fixture();
  const cleanup = createFeedbackCleanup(f.storage, f.wipe, f.checks);
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
  const cleanup = createFeedbackCleanup(f.storage, f.wipe, f.checks);
  f.storage.removeItem.mockRejectedValueOnce(new Error('disk locked'));
  await expect(cleanup.clear()).rejects.toThrow();
  expect(cleanup.getSnapshot()).toBe(true);
  expect(f.values.get(FEEDBACK_CLEANUP_KEY)).toBe('1');
  await cleanup.retry();
  expect(cleanup.getSnapshot()).toBe(false);
});

test('concurrent startup and forced withdrawal cannot lose the forced wipe', async () => {
  const f = fixture();
  const cleanup = createFeedbackCleanup(f.storage, f.wipe, f.checks);
  await Promise.all([cleanup.retry(), cleanup.clear(), cleanup.retry()]);
  expect(f.wipe).toHaveBeenCalledTimes(1);
  expect(f.values.size).toBe(0);
});

test('marker storage failure does not prevent the requested deletion', async () => {
  const f = fixture();
  const cleanup = createFeedbackCleanup(f.storage, f.wipe, f.checks);
  f.storage.setItem.mockRejectedValueOnce(new Error('marker write unavailable'));
  await cleanup.clear();
  expect(f.wipe).toHaveBeenCalledTimes(1);
  expect(cleanup.getSnapshot()).toBe(false);
});

test('a marker getItem failure preserves active answers, blocks saves and recovers by rereading', async () => {
  const f = fixture();
  let residual = true;
  const wipe = jest.fn(async () => { residual = false; });
  const cleanup = createFeedbackCleanup(f.storage, wipe, { ...f.checks, hasFeedback: async () => residual });
  f.storage.getItem.mockRejectedValueOnce(new Error('locked'));
  await cleanup.retry();
  expect(wipe).not.toHaveBeenCalled();
  expect(residual).toBe(true);
  expect(cleanup.canSave()).toBe(false);
  const write = jest.fn(async () => {});
  await expect(cleanup.save(write)).rejects.toThrow();
  expect(write).not.toHaveBeenCalled();
  await cleanup.retry();
  expect(cleanup.canSave()).toBe(true);
  expect(residual).toBe(true);
});

test.each(['unknown', 'profile-error'] as const)('transient %s consent at startup preserves answers without authorizing saves', async (status) => {
  const f = fixture();
  const readConsent = jest.fn(async (): Promise<'active'|'unknown'> => {
    if (status === 'profile-error') throw new Error('offline');
    return 'unknown';
  });
  const cleanup = createFeedbackCleanup(f.storage, f.wipe, { readConsent, hasFeedback: async () => true });
  await cleanup.retry();
  expect(f.wipe).not.toHaveBeenCalled();
  const write = jest.fn(async () => {});
  await expect(cleanup.save(write)).rejects.toThrow();
  expect(write).not.toHaveBeenCalled();
  readConsent.mockResolvedValue('active');
  await cleanup.retry();
  expect(cleanup.canSave()).toBe(true);
  expect(f.wipe).not.toHaveBeenCalled();
});

test('a marker read failure during save preserves answers and refuses the new write', async () => {
  const f = fixture();
  const cleanup = createFeedbackCleanup(f.storage, f.wipe, { ...f.checks, hasFeedback: async () => true });
  await cleanup.retry();
  f.storage.getItem.mockRejectedValueOnce(new Error('locked'));
  const write = jest.fn(async () => {});
  await expect(cleanup.save(write)).rejects.toThrow();
  expect(write).not.toHaveBeenCalled();
  expect(f.wipe).not.toHaveBeenCalled();
  expect(cleanup.canSave()).toBe(false);
});

test.each(['0', 'unexpected'])('a successfully read marker %s does not authorize deletion', async (hint) => {
  const f = fixture();
  f.values.set(FEEDBACK_CLEANUP_KEY, hint);
  const cleanup = createFeedbackCleanup(f.storage, f.wipe, { ...f.checks, hasFeedback: async () => true });
  await cleanup.retry();
  expect(f.wipe).not.toHaveBeenCalled();
});

test('withdrawal during a save consent lookup invalidates that save before any answer is written', async () => {
  const f = fixture();
  const readConsent = jest.fn(async () => 'active' as const);
  const cleanup = createFeedbackCleanup(f.storage, f.wipe, { ...f.checks, readConsent });
  await cleanup.retry();
  let release = (_consent: 'active'): void => {};
  let started = (): void => {};
  const checking = new Promise<void>((resolve) => { started = resolve; });
  readConsent.mockImplementationOnce(() => {
    started();
    return new Promise<'active'>((resolve) => { release = resolve; });
  });
  const write = jest.fn(async () => {});
  const saving = cleanup.save(write);
  await checking;
  const clearing = cleanup.clear();
  release('active');
  await expect(saving).rejects.toThrow();
  await clearing;
  expect(write).not.toHaveBeenCalled();
  expect(f.wipe).toHaveBeenCalledTimes(1);
});

test('a new cleanup instance recovers residual answers after BOTH marker write and wipe failed with consent revoked', async () => {
  const f = fixture();
  let residual = true;
  const wipe = jest.fn(async () => { residual = false; });
  wipe.mockRejectedValueOnce(new Error('locked'));
  const reconciliation = { readConsent: async () => 'inactive' as const, hasFeedback: async () => residual };
  f.storage.setItem.mockRejectedValueOnce(new Error('marker unavailable'));
  const first = createFeedbackCleanup(f.storage, wipe, reconciliation);
  await expect(first.clear()).rejects.toThrow();
  expect(f.values.size).toBe(0);
  expect(residual).toBe(true);
  const restarted = createFeedbackCleanup(f.storage, wipe, reconciliation);
  await restarted.retry();
  expect(residual).toBe(false);
  expect(wipe).toHaveBeenCalledTimes(2);
  expect(restarted.getSnapshot()).toBe(false);
});

test('the same double failure followed by UNKNOWN consent preserves residual answers and blocks saves', async () => {
  const f = fixture();
  let residual = true;
  const wipe = jest.fn(async () => { residual = false; });
  wipe.mockRejectedValueOnce(new Error('locked'));
  const checks = { readConsent: async () => 'unknown' as const, hasFeedback: async () => residual };
  f.storage.setItem.mockRejectedValueOnce(new Error('marker unavailable'));
  const first = createFeedbackCleanup(f.storage, wipe, checks);
  await expect(first.clear()).rejects.toThrow();
  const restarted = createFeedbackCleanup(f.storage, wipe, checks);
  await restarted.retry();
  expect(residual).toBe(true);
  expect(wipe).toHaveBeenCalledTimes(1);
  const write = jest.fn(async () => {});
  await expect(restarted.save(write)).rejects.toThrow();
  expect(write).not.toHaveBeenCalled();
});

test('unknown consent and pending cleanup block saves, and later retries preserve a post-reconsent answer', async () => {
  const f = fixture();
  let answerExists = true;
  let consent: 'unknown' | 'active' | 'inactive' = 'unknown';
  const wipe = jest.fn(async () => { answerExists = false; });
  const cleanup = createFeedbackCleanup(f.storage, wipe, {
    readConsent: async () => consent, hasFeedback: async () => answerExists,
  });
  const save = jest.fn(async () => { answerExists = true; });
  await expect(cleanup.save(save)).rejects.toThrow();
  expect(save).not.toHaveBeenCalled();
  wipe.mockRejectedValueOnce(new Error('locked'));
  await expect(cleanup.clear()).rejects.toThrow();
  consent = 'active';
  await expect(cleanup.save(save)).rejects.toThrow();
  expect(save).not.toHaveBeenCalled();
  await cleanup.retry();
  await cleanup.save(save);
  expect(save).toHaveBeenCalledTimes(1);
  const wiped = wipe.mock.calls.length;
  await cleanup.retry();
  expect(wipe).toHaveBeenCalledTimes(wiped);
  expect(answerExists).toBe(true);
});
