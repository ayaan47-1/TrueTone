// src/features/shade/ShadeMatchResult.tsx
// Composes the live camera shade-match result: the derived shade (ShadeResult) plus a
// "Picked for your shade" rail. Presentation only -- the shade is derived and persisted by
// the route (app/scan/result.tsx); ranking is the same pure engine the Shop/For You shelves
// use. No skin-health scores, no analysis breakdown (user directive; cosmetic-only per
// CLAUDE.md §0/§1). Consumes only derived descriptors -- never the image.
import { ShadeResult } from './ShadeResult';
import { ProductRail } from '../foryou/ProductRail';
import { resolveForYouProfile, pickedForYourShade } from '../foryou/for-you-profile';
import { preferencesStore } from '../preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../preferences/preferences-types';
import type { CurrentShade } from './shade-types';

interface ShadeMatchResultProps {
  /** The derived shade to present (route already persisted it via personalization.setScan). */
  shade: CurrentShade;
  /** "See my look" -> the route sends the user to their shelf. */
  onSeeLook?: () => void;
  /** "Share" -> share sheet is a shell this phase. */
  onShare?: () => void;
}

export function ShadeMatchResult({ shade, onSeeLook, onShare }: ShadeMatchResultProps) {
  const prefs = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;
  // A real shade in hand -> a concrete match profile (no demo stub, no image).
  const profile = resolveForYouProfile(true, shade, prefs, false);
  const picks = profile ? pickedForYourShade(profile) : [];

  return (
    <ShadeResult
      shade={shade}
      onSeeLook={onSeeLook}
      onShare={onShare}
      picks={
        profile ? (
          <ProductRail
            title="Picked for your shade"
            subtitle="Matched to your tone"
            products={picks}
            profile={profile}
          />
        ) : null
      }
    />
  );
}
