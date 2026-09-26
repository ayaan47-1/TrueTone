// src/features/identity/use-community-profile.ts
// Account-screen hook: loads/saves the CommunityProfile and owns the avatar-picker flow.
// Picks the backend the same way profile-context.tsx does (DEMO_MODE/CAMERA_DEMO ->
// local, else Supabase) so this respects the same demo/live boundary as the rest of the
// app. Avatar picking is only offered once a username exists -- CommunityProfile has no
// "username unset" state (see community-profile-types.ts), so there is nothing to attach
// a picked avatar to yet.
import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { DEMO_MODE, CAMERA_DEMO } from '../../lib/supabase';
import {
  createLocalCommunityProfileRepository,
  createSupabaseCommunityProfileRepository,
  type CommunityProfileRepository,
} from './community-profile-repository';
import { normalizeUsername, validateUsername, type CommunityProfile } from './community-profile-types';

export type SaveUsernameResult = { ok: true } | { ok: false; error: string };
export type AvatarStatus = 'idle' | 'picking' | 'unavailable' | 'error';

interface UseCommunityProfileResult {
  profile: CommunityProfile | null;
  loading: boolean;
  saveUsername: (raw: string) => Promise<SaveUsernameResult>;
  pickAvatar: () => Promise<void>;
  avatarStatus: AvatarStatus;
}

function defaultRepository(): CommunityProfileRepository {
  return DEMO_MODE || CAMERA_DEMO
    ? createLocalCommunityProfileRepository()
    : createSupabaseCommunityProfileRepository();
}

/** A Postgres unique-violation from the live repository's save() -- see migration 0021. */
function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: unknown }).code === '23505';
}

export function useCommunityProfile(
  userId: string | null,
  repository: CommunityProfileRepository = defaultRepository(),
): UseCommunityProfileResult {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    repository
      .load(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const saveUsername = useCallback(
    async (raw: string): Promise<SaveUsernameResult> => {
      if (!userId) return { ok: false, error: 'No signed-in profile yet.' };
      const validation = validateUsername(raw);
      if (!validation.valid) return { ok: false, error: validation.reason };
      try {
        const saved = await repository.save({
          userId,
          username: normalizeUsername(raw),
          avatarUri: profile?.avatarUri ?? null,
        });
        setProfile(saved);
        return { ok: true };
      } catch (err) {
        if (isUniqueViolation(err)) return { ok: false, error: 'That username is taken.' };
        return { ok: false, error: 'Could not save your username. Try again.' };
      }
    },
    [userId, profile, repository],
  );

  const pickAvatar = useCallback(async () => {
    if (!userId || !profile) return;
    setAvatarStatus('picking');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setAvatarStatus('unavailable');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) {
        setAvatarStatus('idle');
        return;
      }
      const saved = await repository.save({
        userId,
        username: profile.username,
        avatarUri: result.assets[0].uri,
      });
      setProfile(saved);
      setAvatarStatus('idle');
    } catch {
      // Permission denial, picker cancel, or a save failure all resolve here -- never
      // crash the Account screen over an avatar pick.
      setAvatarStatus('error');
    }
  }, [userId, profile, repository]);

  return { profile, loading, saveUsername, pickAvatar, avatarStatus };
}
