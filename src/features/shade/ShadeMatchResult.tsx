// src/features/shade/ShadeMatchResult.tsx
// Composes the live camera shade-match result: the derived shade (ShadeResult) plus a
// "Picked for your shade" rail. Presentation only -- the shade is derived and persisted by
// the route (app/scan/result.tsx); ranking is the same pure engine the Shop/For You shelves
// use. No skin-health scores, no analysis breakdown (user directive; cosmetic-only per
// CLAUDE.md §0/§1). Consumes only derived descriptors -- never the image.
//
// Task 10: owns the real share flow. A branded ScanShareCard (descriptors + TrueTone
// branding + the download link only, never the image) renders off-screen and is captured
// to a temp PNG by useScanShare when "Share" is pressed.
import { View } from 'react-native';
import { ShadeResult } from './ShadeResult';
import { ScanShareCard } from './ScanShareCard';
import { useScanShare } from './use-scan-share';
import { ProductRail } from '../foryou/ProductRail';
import { resolveForYouProfile, pickedForYourShade } from '../foryou/for-you-profile';
import { preferencesStore } from '../preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../preferences/preferences-types';
import type { CurrentShade } from './shade-types';

interface ShadeMatchResultProps {
  /** The derived shade to present (persisted at capture via personalization.setScan). */
  shade: CurrentShade;
  /** "See my look" -> the route sends the user to their shelf. */
  onSeeLook?: () => void;
  /** Fired after the native share sheet is dismissed (optional; kept for callers/tests). */
  onShare?: () => void;
}

export function ShadeMatchResult({ shade, onSeeLook, onShare }: ShadeMatchResultProps) {
  const prefs = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;
  // A real shade in hand -> a concrete match profile (no demo stub, no image).
  const profile = resolveForYouProfile(true, shade, prefs, false);
  const picks = profile ? pickedForYourShade(profile) : [];
  const { shareCardRef, share } = useScanShare();

  const handleShare = async () => {
    await share();
    onShare?.();
  };

  return (
    <>
      <ShadeResult
        shade={shade}
        onSeeLook={onSeeLook}
        onShare={handleShare}
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
      {/* Off-screen capture target for the OS share sheet -- never rendered visibly. */}
      <View
        collapsable={false}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: -9999 }}
      >
        <View ref={shareCardRef} collapsable={false}>
          <ScanShareCard shade={shade} />
        </View>
      </View>
    </>
  );
}
