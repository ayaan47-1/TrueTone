// src/features/identity/community-profile-repository.ts
// Repository boundary for CommunityProfile. Demo/camera-demo modes persist a
// user-scoped identity on-device (encrypted AsyncStorage, no network); live mode reads/writes
// Supabase `profiles.username` only.
//
// DEFERRED (explicit boundary): `avatarUri` is a user-scoped LOCAL file URI in this
// release, in both backends, and is stored only in encrypted on-device storage; the live
// backend never writes `profiles.avatar_uri` (MASVS M1): the column is scrubbed, client-locked and
// constrained to null by the profile_avatar_lock migration, and delete_my_data clears it server-side. Cross-device avatar media storage (uploading the picked
// image to a Supabase Storage bucket) is NOT implemented here -- there is no
// approved bucket/policy for it yet. Do not add an upload path behind this repository
// without that approval; a picked avatar simply does not follow the user to a second
// device this release.
import { encryptedStorage } from '../../lib/encrypted-storage';
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

async function clearMissingAvatar(key: string, stored: string, uri: string | null, next: string | null): Promise<string | null> {
  if (!uri || !uri.startsWith('file://')) return uri;
  try {
    const fs: typeof import('expo-file-system/legacy') = require('expo-file-system/legacy');
    if ((await fs.getInfoAsync(uri)).exists !== false) return uri;
    await encryptedStorage.replaceIfUnchanged(key, stored, next);
    return null;
  } catch {
    // A failed metadata read or storage write is not proof that the reference can be removed.
    return uri;
  }
}

/** Demo / camera-demo backend: user-scoped encrypted AsyncStorage, no network, no cross-user check. */
export function createLocalCommunityProfileRepository(): CommunityProfileRepository {
  return {
    async load(userId) {
      try {
        const raw = await encryptedStorage.getItem(localKey(userId));
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isCommunityProfileShape(parsed)) return null;
        const profile = {
          userId,
          username: parsed.username,
          avatarUri: typeof parsed.avatarUri === 'string' ? parsed.avatarUri : null,
        };
        profile.avatarUri = await clearMissingAvatar(localKey(userId), raw, profile.avatarUri,
          JSON.stringify({ ...profile, avatarUri: null }));
        return profile;
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
      await encryptedStorage.setItem(localKey(profile.userId), JSON.stringify(next));
      return next;
    },
  };
}

function localAvatarKey(userId: string): string {
  // Under the managed community-profile prefix: encrypted at rest and removed by
  // wipeEncryptedLocalData (Delete My Data / Delete Account).
  return `truetone.community-profile.avatar.v1.${userId}`;
}

async function loadLocalAvatar(userId: string): Promise<string | null> {
  try {
    const key = localAvatarKey(userId);
    const uri = await encryptedStorage.getItem(key);
    return uri ? await clearMissingAvatar(key, uri, uri, null) : null;
  } catch {
    return null;
  }
}

async function saveLocalAvatar(userId: string, uri: string | null): Promise<void> {
  if (uri) await encryptedStorage.setItem(localAvatarKey(userId), uri);
  else await encryptedStorage.removeItem(localAvatarKey(userId));
}

// Minimal shape of the Supabase query chain this repository needs, so it can be
// exercised in tests without a live Supabase (the real client structurally satisfies
// this -- see community-profile-repository.test.ts for the fake).
export interface ProfilesClient {
  from(table: 'profiles'): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{ data: { username: string | null } | null; error: unknown }>;
      };
    };
    update(values: { username: string }): {
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
        .select('username')
        .eq('id', userId)
        .single();
      if (error || !data || typeof data.username !== 'string') return null;
      // MASVS M1: the photo path is device-local only; the server column is never read.
      return { userId, username: data.username, avatarUri: await loadLocalAvatar(userId) };
    },
    async save(profile) {
      // MASVS M1: the photo URI is device-local state; clients may update only username.
      const { error } = await client
        .from('profiles')
        .update({ username: profile.username })
        .eq('id', profile.userId);
      if (error) throw error;
      await saveLocalAvatar(profile.userId, profile.avatarUri);
      return profile;
    },
  };
}
