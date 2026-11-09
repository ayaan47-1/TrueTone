// src/features/foryou/__tests__/use-recent-shade-matches.test.ts
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRecentShadeMatches } from '../use-recent-shade-matches';
import type { ShadeMatchEntry } from '../../../lib/scans';
import { bumpShadeHistoryRevision } from '../../shade-history/shade-history-revision';

const entry: ShadeMatchEntry = {
  id: 'a', capturedAt: '2026-09-27T15:00:00Z',
  shade: { depthBand: 'tan', undertone: 'warm', finish: 'satin', shadeName: 'Tan Warm' },
};

test('loads the last five matches', async () => {
  const fetcher = jest.fn().mockResolvedValue([entry]);
  const { result } = await renderHook(() => useRecentShadeMatches({ fetcher, enabled: true }));
  await waitFor(() => expect(result.current).toEqual({ status: 'ready', matches: [entry] }));
  expect(fetcher).toHaveBeenCalledWith(5);
});

test('reports an error state when the fetch fails', async () => {
  const fetcher = jest.fn().mockRejectedValue(new Error('fetch-shade-history-failed'));
  const { result } = await renderHook(() => useRecentShadeMatches({ fetcher, enabled: true }));
  await waitFor(() => expect(result.current).toEqual({ status: 'error' }));
});

test('does not fetch when disabled (demo mode) and reports an empty list', async () => {
  const fetcher = jest.fn();
  const { result } = await renderHook(() => useRecentShadeMatches({ fetcher, enabled: false }));
  await waitFor(() => expect(result.current).toEqual({ status: 'ready', matches: [] }));
  expect(fetcher).not.toHaveBeenCalled();
});

test('refetches when the refresh key changes (a new scan)', async () => {
  const fetcher = jest.fn().mockResolvedValue([entry]);
  const { rerender } = await renderHook(
    ({ k }: { k: string }) => useRecentShadeMatches({ fetcher, enabled: true, refreshKey: k }),
    { initialProps: { k: 'one' } },
  );
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await rerender({ k: 'two' });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
});

test('refetches after shade history changes even when the shade name stays the same', async () => {
  const fetcher = jest.fn().mockResolvedValue([entry]);
  await renderHook(() => useRecentShadeMatches({ fetcher, enabled: true, refreshKey: 'Warm Sand' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await act(async () => { bumpShadeHistoryRevision(); });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
});

test('hides cached labels synchronously while a revision refetch is pending', async () => {
  let resolveRefetch: ((matches: ShadeMatchEntry[]) => void) | undefined;
  const fetcher = jest
    .fn<Promise<ShadeMatchEntry[]>, [number]>()
    .mockResolvedValueOnce([entry])
    .mockImplementationOnce(() => new Promise((resolve) => { resolveRefetch = resolve; }));
  const { result } = await renderHook(() => useRecentShadeMatches({
    fetcher,
    enabled: true,
    refreshKey: 'Warm Sand',
  }));
  await waitFor(() => expect(result.current).toEqual({ status: 'ready', matches: [entry] }));

  await act(async () => { bumpShadeHistoryRevision(); });

  expect(result.current).toEqual({ status: 'loading' });
  resolveRefetch?.([]);
  await waitFor(() => expect(result.current).toEqual({ status: 'ready', matches: [] }));
});

test('a fetcher that throws synchronously still lands in the error state (no crash)', async () => {
  const fetcher = jest.fn(() => { throw new Error('boom'); });
  const { result } = await renderHook(() => useRecentShadeMatches({ fetcher, enabled: true }));
  await waitFor(() => expect(result.current).toEqual({ status: 'error' }));
});
