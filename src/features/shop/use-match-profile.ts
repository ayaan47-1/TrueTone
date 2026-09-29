// src/features/shop/use-match-profile.ts
// Assembles the derived shade (from the on-device scan) + the structured Setup preferences
// into the ONE MatchProfile the shop needs — never the raw image (CLAUDE.md §3). Before a
// scan there is no profile, so shop surfaces render neutrally.
import type { MatchProfile } from '../match/match-types';
import { usePersonalization } from '../session/personalization';
import { preferencesStore } from '../preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../preferences/preferences-types';

export interface ShopProfile {
  profile?: MatchProfile;
  /** The derived shade word, e.g. "Medium Warm" (post-scan only). */
  shadeName?: string;
}

export function useMatchProfile(): ShopProfile {
  const { hasScanned, currentShade } = usePersonalization();
  if (!hasScanned || !currentShade) return {};
  const prefs = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;
  return {
    profile: {
      shade: currentShade.depth,
      undertone: currentShade.undertone,
      coverage: prefs.coverage,
      skips: prefs.skips,
    },
    shadeName: currentShade.shadeName,
  };
}
