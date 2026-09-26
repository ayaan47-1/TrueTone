import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRoutineLog, saveDay, clearRoutine, routineKey } from '../routine-storage';
import { addProduct, emptyDay } from '../routine-logic';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('key is user-scoped', () => {
  expect(routineKey('u1')).not.toEqual(routineKey('u2'));
  expect(routineKey('u1')).toContain('u1');
});

test('empty log for a user with nothing stored', async () => {
  expect(await getRoutineLog('u1')).toEqual({});
});

test('saveDay persists a day and getRoutineLog reads it back', async () => {
  const day = addProduct(emptyDay('2026-09-26'), 'am', 'lum-tint-01');
  await saveDay('u1', day);
  expect(await getRoutineLog('u1')).toEqual({ '2026-09-26': day });
});

test("one user's log does not leak into another's", async () => {
  await saveDay('u1', addProduct(emptyDay('2026-09-26'), 'am', 'lum-tint-01'));
  expect(await getRoutineLog('u2')).toEqual({});
});

test('clearRoutine wipes the user log', async () => {
  await saveDay('u1', addProduct(emptyDay('2026-09-26'), 'pm', 'sol-full-07'));
  await clearRoutine('u1');
  expect(await getRoutineLog('u1')).toEqual({});
});

test('corrupt storage fails safe to empty', async () => {
  await AsyncStorage.setItem(routineKey('u1'), 'not-json{{{');
  expect(await getRoutineLog('u1')).toEqual({});
});
