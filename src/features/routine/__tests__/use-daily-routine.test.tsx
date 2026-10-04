import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDailyRoutine } from '../use-daily-routine';
import { clearAllRoutines, getRoutineLog, saveDay } from '../routine-storage';

const NOW = new Date(2026, 9, 4, 9); // 2026-10-04 local

beforeEach(async () => {
  await AsyncStorage.clear();
});

test("carries yesterday's routine forward when today has nothing saved", async () => {
  await saveDay('u1', { date: '2026-10-03', am: ['a', 'b'], pm: ['c'] });
  const { result } = await renderHook(() => useDailyRoutine('u1', NOW));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.today).toEqual({ date: '2026-10-04', am: ['a', 'b'], pm: ['c'] });
  expect(result.current.summary).toMatchObject({ amCount: 2, pmCount: 1, todayCount: 3 });
});

test('replaceInSlot edits a step in place and persists it', async () => {
  await saveDay('u1', { date: '2026-10-04', am: ['a', 'b'], pm: [] });
  const { result } = await renderHook(() => useDailyRoutine('u1', NOW));
  await waitFor(() => expect(result.current.today.am).toEqual(['a', 'b']));
  await act(async () => result.current.replaceInSlot('am', 'a', 'z'));
  expect(result.current.today.am).toEqual(['z', 'b']);
  await waitFor(async () => expect((await getRoutineLog('u1'))['2026-10-04'].am).toEqual(['z', 'b']));
});

test('an edit in one screen shows up in another mounted instance (Home card ↔ Routine page)', async () => {
  const a = await renderHook(() => useDailyRoutine('u1', NOW));
  const b = await renderHook(() => useDailyRoutine('u1', NOW));
  await waitFor(() => expect(b.result.current.loading).toBe(false));
  await act(async () => a.result.current.addToSlot('pm', 'p1'));
  await waitFor(() => expect(b.result.current.today.pm).toEqual(['p1']));
});

test('rapid edits are not lost to overlapping saves', async () => {
  const { result } = await renderHook(() => useDailyRoutine('u1', NOW));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    result.current.addToSlot('am', 'x');
  });
  await act(async () => {
    result.current.addToSlot('am', 'y');
  });
  await waitFor(async () => expect((await getRoutineLog('u1'))['2026-10-04'].am).toEqual(['x', 'y']));
});

test('reload() re-reads storage', async () => {
  const { result } = await renderHook(() => useDailyRoutine('u1', NOW));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await AsyncStorage.setItem(
    'truetone.routine.u1.v1',
    JSON.stringify({ '2026-10-04': { date: '2026-10-04', am: ['r'], pm: [] } }),
  );
  await act(async () => {
    await result.current.reload();
  });
  expect(result.current.today.am).toEqual(['r']);
});

test('three edits fired back to back (no awaits between) all land, in UI and storage', async () => {
  const { result } = await renderHook(() => useDailyRoutine('u1', NOW));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    result.current.addToSlot('am', 'a');
    result.current.addToSlot('am', 'b');
    result.current.replaceInSlot('am', 'a', 'z');
  });
  await waitFor(async () => expect((await getRoutineLog('u1'))['2026-10-04'].am).toEqual(['z', 'b']));
  expect(result.current.today.am).toEqual(['z', 'b']);
});

test('a failed save reverts to what storage holds instead of pretending it saved', async () => {
  const { result } = await renderHook(() => useDailyRoutine('u1', NOW));
  await waitFor(() => expect(result.current.loading).toBe(false));
  // setItem is already a jest mock (async-storage's jest mock): fail it once, never mockRestore it.
  (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('disk full')));
  await act(async () => {
    result.current.addToSlot('am', 'a');
  });
  await waitFor(() => expect(result.current.today.am).toEqual([]));
});

test('clearing all routines (delete everything) empties mounted screens', async () => {
  await saveDay('u1', { date: '2026-10-04', am: ['a'], pm: [] });
  const { result } = await renderHook(() => useDailyRoutine('u1', NOW));
  await waitFor(() => expect(result.current.today.am).toEqual(['a']));
  await act(async () => {
    await clearAllRoutines();
  });
  await waitFor(() => expect(result.current.today.am).toEqual([]));
});
