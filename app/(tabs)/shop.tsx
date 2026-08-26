import { Screen, TAB_BAR_CLEARANCE } from '../../src/components/ui';
import { ShopList } from '../../src/features/shop/ShopList';
import type { MatchProfile } from '../../src/features/match/match-types';
import { usePersonalization } from '../../src/features/session/personalization';
import { preferencesStore } from '../../src/features/preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../../src/features/preferences/preferences-types';

/**
 * Shop tab. Assembles the derived shade (from the on-device scan) + the structured
 * Setup preferences into the ONE MatchProfile the shop needs — never the raw image
 * (CLAUDE.md §3). Before a scan there is no profile, so the shelf renders neutrally.
 */
export default function ShopScreen() {
  const { hasScanned, currentShade } = usePersonalization();
  const prefs = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;

  const profile: MatchProfile | undefined =
    hasScanned && currentShade
      ? {
          shade: currentShade.depth,
          undertone: currentShade.undertone,
          coverage: prefs.coverage,
          skips: prefs.skips,
        }
      : undefined;

  return (
    <Screen className="px-6" bottomGap={TAB_BAR_CLEARANCE}>
      <ShopList profile={profile} />
    </Screen>
  );
}
