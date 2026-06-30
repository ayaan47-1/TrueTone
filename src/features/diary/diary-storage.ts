import AsyncStorage from '@react-native-async-storage/async-storage';
import { toDateKey } from '../today/week';
import { isMoodValue, type MoodValue } from './moods';

/**
 * Skin-feel diary, stored ON-DEVICE only (never synced to a server in v0). A single
 * key holds a { dateKey: mood } map so it's trivial to read and to wipe. `clearDiary`
 * is wired into delete-everything so the diary is covered by data-rights deletion.
 */
const KEY = 'truetone.diary.v1';

type DiaryMap = Record<string, MoodValue>;

async function readMap(): Promise<DiaryMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as DiaryMap;
  } catch {
    // Corrupt or unreadable storage — fail safe to an empty diary.
    return {};
  }
}

export async function getMood(today: Date = new Date()): Promise<MoodValue | null> {
  const map = await readMap();
  const v = map[toDateKey(today)];
  return isMoodValue(v) ? v : null;
}

export async function setMood(value: MoodValue, today: Date = new Date()): Promise<void> {
  const map = await readMap();
  const next: DiaryMap = { ...map, [toDateKey(today)]: value };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function clearDiary(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
