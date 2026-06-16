// src/features/read/__tests__/image-lifecycle.test.ts
import { withImageCleanup } from '../image-lifecycle';

test('deletes the image after a successful run and returns the result', async () => {
  const del = jest.fn().mockResolvedValue(undefined);
  const result = await withImageCleanup('file://x.jpg', async () => 42, del);
  expect(result).toBe(42);
  expect(del).toHaveBeenCalledWith('file://x.jpg');
});
test('deletes the image even when the run throws', async () => {
  const del = jest.fn().mockResolvedValue(undefined);
  await expect(
    withImageCleanup('file://x.jpg', async () => { throw new Error('read failed'); }, del),
  ).rejects.toThrow('read failed');
  expect(del).toHaveBeenCalledTimes(1);
});
test('retries deletion and signals failure without throwing out of cleanup', async () => {
  const del = jest.fn().mockRejectedValue(new Error('locked'));
  const onCleanupFailure = jest.fn();
  const result = await withImageCleanup('file://x.jpg', async () => 'ok', del, { retries: 2, onCleanupFailure });
  expect(result).toBe('ok');
  expect(del).toHaveBeenCalledTimes(3);          // initial + 2 retries
  expect(onCleanupFailure).toHaveBeenCalledTimes(1);
});
