// src/features/identity/community-profile-repository.ts
// Repository boundary for CommunityProfile. Demo/camera-demo modes persist a
// user-scoped identity on-device (AsyncStorage, no network); live mode reads/writes
// Supabase `profiles.username` / `profiles.avatar_uri`.
//
// DEFERRED (explicit boundary): `avatarUri` is a user-scoped LOCAL file URI in this
// release, in both backends. Cross-device avatar media storage (uploading the picked
// image to a Supabase Storage bucket) is NOT implemented here -- there is no
// approved bucket/policy for it yet. Do not add an upload path behind this repository
// without that approval; a picked avatar simply does not follow the user to a second
// device this release.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import type { CommunityProfile } from './community-profile-types';

export interface CommunityProfileRepository {
  load(userId: string): Promise<CommunityProfile | null>;
  save(profile: CommunityProfile): Promise<CommunityProfile>;
}

function localKey(userId: string): string {
  return `truetone.community-profile.v1.${userId}`;
}

function isCommunityProfileShape(v: unknown): v is { username: string; avatarUri?: unknown } {
  return !!v && typeof v === 'object' && typeof (v as Record<string, unknown>).username === 'string';
}

/** Demo / camera-demo backend: user-scoped AsyncStorage, no network, no cross-user check. */
export function createLocalCommunityProfileRepository(): CommunityProfileRepository {
  return {
    async load(userId) {
      try {
        const raw = await AsyncStorage.getItem(localKey(userId));
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isCommunityProfileShape(parsed)) return null;
        return {
          userId,
          username: parsed.username,
          avatarUri: typeof parsed.avatarUri === 'string' ? parsed.avatarUri : null,
        };
      } catch {
        // Corrupt or unreadable storage -- fail safe to "no profile yet".
        return null;
      }
    },
    async save(profile) {
      const next: CommunityProfile = {
        userId: profile.userId,
        username: profile.username,
        avatarUri: profile.avatarUri,
      };
      await AsyncStorage.setItem(localKey(profile.userId), JSON.stringify(next));
      return next;
    },
  };
}

// Minimal shape of the Supabase query chain this repository needs, so it can be
// exercised in tests without a live Supabase (the real client structurally satisfies
// this -- see community-profile-repository.test.ts for the fake).
export interface ProfilesClient {
  from(table: 'profiles'): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{ data: { username: string | null; avatar_uri: string | null } | null; error: unknown }>;
      };
    };
    update(values: { username: string; avatar_uri: string | null }): {
      eq(column: string, value: string): Promise<{ error: unknown }>;
    };
  };
}

/**
 * Live backend. Global username uniqueness is enforced by the database (migration
 * 0021's case-insensitive unique index) -- a unique-violation (Postgres code 23505)
 * surfacing from save() means "that handle is taken", not a bug; callers (see
 * community-profile-context.tsx) translate it into a user-facing message instead of
 * ever pre-checking uniqueness locally.
 */
export function createSupabaseCommunityProfileRepository(
  // The real client's query-builder methods are thenable but not literally typed as
  // `Promise<T>`; narrow to this repository's minimal shape at the boundary instead
  // of widening ProfilesClient to match supabase-js's builder types exactly.
  client: ProfilesClient = supabase as unknown as ProfilesClient,
): CommunityProfileRepository {
  return {
    async load(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('username, avatar_uri')
        .eq('id', userId)
        .single();
      if (error || !data || typeof data.username !== 'string') return null;
      return { userId, username: data.username, avatarUri: data.avatar_uri ?? null };
    },
    async save(profile) {
      const { error } = await client
        .from('profiles')
        .update({ username: profile.username, avatar_uri: profile.avatarUri })
        .eq('id', profile.userId);
      if (error) throw error;
      return profile;
    },
  };
}
