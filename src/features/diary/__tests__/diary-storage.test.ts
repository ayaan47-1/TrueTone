jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMood, setMood, clearDiary } from '../diary-storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('returns null when no mood is logged today', async () => {
  expect(await getMood(new Date(2026, 5, 24))).toBeNull();
});

test('persists and reads back today’s mood', async () => {
  await setMood('glowy', new Date(2026, 5, 24));
  expect(await getMood(new Date(2026, 5, 24))).toBe('glowy');
});

test('keeps moods per-day (a different day is independent)', async () => {
  await setMood('calm', new Date(2026, 5, 24));
  expect(await getMood(new Date(2026, 5, 25))).toBeNull();
});

test('overwrites the same day', async () => {
  await setMood('tired', new Date(2026, 5, 24));
  await setMood('dry', new Date(2026, 5, 24));
  expect(await getMood(new Date(2026, 5, 24))).toBe('dry');
});

test('clearDiary erases everything (delete-everything wiring)', async () => {
  await setMood('calm', new Date(2026, 5, 24));
  await clearDiary();
  expect(await getMood(new Date(2026, 5, 24))).toBeNull();
});

test('ignores corrupt stored data without throwing', async () => {
  await AsyncStorage.setItem('truetone.diary.v1', '{not json');
  expect(await getMood(new Date(2026, 5, 24))).toBeNull();
});
