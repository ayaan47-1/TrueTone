import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildCommunityRoutine,
  publishDailyRoutine,
  getPublishedRoutines,
  clearPublishedRoutines,
} from '../routine-publish';
import { addProduct, emptyDay } from '../routine-logic';
import type { CommunityProfile } from '../../identity/community-profile-types';

const profile: CommunityProfile = { userId: 'u1', username: 'maya', avatarUri: null };
const CAT = [
  { id: 'lum-tint-01', name: 'Weightless Skin Tint' },
  { id: 'sol-full-07', name: 'Full-Cover Foundation' },
];

function dayWith(am: string[], pm: string[]) {
  let day = emptyDay('2026-09-26');
  for (const id of am) day = addProduct(day, 'am', id);
  for (const id of pm) day = addProduct(day, 'pm', id);
  return day;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('buildCommunityRoutine (pure)', () => {
  it('maps a logged day into a CommunityRoutine tagging the real product ids', () => {
    const routine = buildCommunityRoutine(profile, dayWith(['lum-tint-01'], ['sol-full-07']), CAT);
    expect(routine).not.toBeNull();
    expect(routine!.id).toBe('pub-u1-2026-09-26');
    expect(routine!.creator).toEqual(profile);
    expect(routine!.taggedProductIds).toEqual(['lum-tint-01', 'sol-full-07']);
    expect(routine!.steps.map((s) => s.title)).toEqual(['Morning', 'Evening']);
    expect(routine!.steps[0].detail).toContain('Weightless Skin Tint');
  });

  it('omits an empty slot and dedupes a product used in both slots', () => {
    const routine = buildCommunityRoutine(profile, dayWith(['lum-tint-01'], ['lum-tint-01']), CAT);
    expect(routine!.taggedProductIds).toEqual(['lum-tint-01']);
    expect(routine!.steps).toHaveLength(2); // both slots have the product
  });

  it('returns null when nothing is logged', () => {
    expect(buildCommunityRoutine(profile, emptyDay('2026-09-26'), CAT)).toBeNull();
  });
});

describe('publishDailyRoutine (storage)', () => {
  it('publishes into the local feed, newest first', async () => {
    await publishDailyRoutine(profile, dayWith(['lum-tint-01'], []), CAT);
    const feed = await getPublishedRoutines();
    expect(feed).toHaveLength(1);
    expect(feed[0].taggedProductIds).toEqual(['lum-tint-01']);
  });

  it('re-publishing the same user+day replaces rather than duplicates', async () => {
    await publishDailyRoutine(profile, dayWith(['lum-tint-01'], []), CAT);
    await publishDailyRoutine(profile, dayWith(['lum-tint-01'], ['sol-full-07']), CAT);
    const feed = await getPublishedRoutines();
    expect(feed).toHaveLength(1);
    expect(feed[0].taggedProductIds).toEqual(['lum-tint-01', 'sol-full-07']);
  });

  it('publishing nothing is a no-op', async () => {
    const result = await publishDailyRoutine(profile, emptyDay('2026-09-26'), CAT);
    expect(result).toBeNull();
    expect(await getPublishedRoutines()).toEqual([]);
  });

  it('clearPublishedRoutines wipes the feed', async () => {
    await publishDailyRoutine(profile, dayWith(['lum-tint-01'], []), CAT);
    await clearPublishedRoutines();
    expect(await getPublishedRoutines()).toEqual([]);
  });
});
