// src/features/foryou/use-recent-shade-matches.ts
// Loads the user's last few saved shade matches (labels only) for the For You tab.
import { useEffect, useState } from 'react';
import { fetchRecentShadeMatches, type ShadeMatchEntry } from '../../lib/scans';

export const RECENT_MATCHES_LIMIT = 5;

export type RecentMatchesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; matches: ShadeMatchEntry[] };

interface Options {
  /** False in demo mode (no backend): skip the fetch and show the empty state. */
  enabled: boolean;
  /** Changing this refetches, e.g. the current shade's name after a new scan. */
  refreshKey?: string | null;
  fetcher?: (limit: number) => Promise<ShadeMatchEntry[]>;
}

export function useRecentShadeMatches({
  enabled,
  refreshKey = null,
  fetcher = fetchRecentShadeMatches,
}: Options): RecentMatchesState {
  const [state, setState] = useState<RecentMatchesState>({ status: 'loading' });
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'ready', matches: [] });
      return;
    }
    let live = true;
    // Promise.resolve().then() turns a synchronous throw into the same error state.
    Promise.resolve()
      .then(() => fetcher(RECENT_MATCHES_LIMIT))
      .then((matches) => { if (live) setState({ status: 'ready', matches }); })
      .catch(() => { if (live) setState({ status: 'error' }); });
    return () => { live = false; };
  }, [enabled, refreshKey, fetcher]);
  return state;
}
