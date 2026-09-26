// src/features/routine/routine-publish.ts
// One-tap publication of a user's daily routine into the LOCAL Community Routines feed.
// Builds a CommunityRoutine (Task 12 types) from the day's logged products, tagging the real
// shop-catalog ids, and appends it to an on-device feed (a single device-local key -- no backend
// table, no network). CommunityScreen merges these ahead of the seeded routines.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CommunityRoutine, CommunityRoutineStep } from '../community/community-types';
import type { CommunityProfile } from '../identity/community-profile-types';
import { catalog as defaultCatalog } from '../match/product-catalog';
import type { DailyRoutine } from './routine-types';

const PUBLISHED_KEY = 'truetone.community.published.v1';

type CatalogEntry = { id: string; name: string };

function nameFor(catalog: readonly CatalogEntry[], id: string): string | null {
  return catalog.find((p) => p.id === id)?.name ?? null;
}

function stepFor(
  catalog: readonly CatalogEntry[],
  routineId: string,
  slot: 'am' | 'pm',
  title: string,
  ids: readonly string[],
): CommunityRoutineStep | null {
  const names = ids.map((id) => nameFor(catalog, id)).filter((n): n is string => n !== null);
  if (names.length === 0) return null;
  return { id: `${routineId}-${slot}`, title, detail: names.join(', ') };
}

/**
 * Build (pure) the CommunityRoutine a day's log publishes as. The id is stable per user+day so
 * re-publishing the same day replaces its earlier entry rather than duplicating it. Returns null
 * when the day has nothing to publish.
 */
export function buildCommunityRoutine(
  profile: CommunityProfile,
  day: DailyRoutine,
  catalog: readonly CatalogEntry[] = defaultCatalog,
): CommunityRoutine | null {
  const taggedProductIds = Array.from(new Set([...day.am, ...day.pm]));
  if (taggedProductIds.length === 0) return null;

  const id = `pub-${profile.userId}-${day.date}`;
  const steps = [
    stepFor(catalog, id, 'am', 'Morning', day.am),
    stepFor(catalog, id, 'pm', 'Evening', day.pm),
  ].filter((s): s is CommunityRoutineStep => s !== null);

  return {
    id,
    creator: profile,
    title: 'My Daily Routine',
    summary: `${day.am.length} AM · ${day.pm.length} PM step${taggedProductIds.length === 1 ? '' : 's'}`,
    steps,
    taggedProductIds,
  };
}

export async function getPublishedRoutines(): Promise<readonly CommunityRoutine[]> {
  try {
    const raw = await AsyncStorage.getItem(PUBLISHED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CommunityRoutine[]) : [];
  } catch {
    return [];
  }
}

/**
 * Publish a day's routine into the local feed. Newest first; re-publishing the same user+day
 * replaces the prior entry. Returns the routine that was published, or null if nothing to publish.
 */
export async function publishDailyRoutine(
  profile: CommunityProfile,
  day: DailyRoutine,
  catalog: readonly CatalogEntry[] = defaultCatalog,
): Promise<CommunityRoutine | null> {
  const routine = buildCommunityRoutine(profile, day, catalog);
  if (!routine) return null;
  const existing = await getPublishedRoutines();
  const deduped = existing.filter((r) => r.id !== routine.id);
  const next = [routine, ...deduped];
  await AsyncStorage.setItem(PUBLISHED_KEY, JSON.stringify(next));
  return routine;
}

export async function clearPublishedRoutines(): Promise<void> {
  await AsyncStorage.removeItem(PUBLISHED_KEY);
}
