// src/features/foryou/use-greeting-name.ts
// The For You header greets by the user's community username ("Hi, Ayaan"). Reads the
// profile through the same demo/live repository split as use-community-profile.ts, but
// without its avatar-picker dependency. A missing profile or failed load -> undefined,
// and the header falls back to "Hi there".
import { useEffect, useState } from 'react';
import { CAMERA_DEMO, DEMO_MODE } from '../../lib/supabase';
import {
  createLocalCommunityProfileRepository,
  createSupabaseCommunityProfileRepository,
  type CommunityProfileRepository,
} from '../identity/community-profile-repository';
import { greetingName } from './HomeHeader';

function defaultRepository(): CommunityProfileRepository {
  return DEMO_MODE || CAMERA_DEMO
    ? createLocalCommunityProfileRepository()
    : createSupabaseCommunityProfileRepository();
}

export function useGreetingName(
  userId: string | null,
  repository?: CommunityProfileRepository,
): string | undefined {
  const [name, setName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!userId) {
      setName(undefined);
      return;
    }
    let cancelled = false;
    (repository ?? defaultRepository())
      .load(userId)
      .then((p) => {
        if (!cancelled) setName(greetingName(p?.username));
      })
      .catch(() => {
        // Greeting is cosmetic: a failed load keeps the neutral "Hi there".
        if (!cancelled) setName(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, repository]);

  return name;
}
