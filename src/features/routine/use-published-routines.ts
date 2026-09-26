// src/features/routine/use-published-routines.ts
// Reads the on-device published-routines feed for CommunityScreen. No userId needed (the feed is
// a single device-local list), so it keeps CommunityScreen's no-props seam intact. Returns [] and
// fills in when loaded -- CommunityScreen renders the seeded routines immediately either way.
import { useEffect, useState } from 'react';
import type { CommunityRoutine } from '../community/community-types';
import { getPublishedRoutines } from './routine-publish';

export function usePublishedRoutines(): readonly CommunityRoutine[] {
  const [published, setPublished] = useState<readonly CommunityRoutine[]>([]);

  useEffect(() => {
    let cancelled = false;
    getPublishedRoutines().then((r) => {
      if (!cancelled) setPublished(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return published;
}
