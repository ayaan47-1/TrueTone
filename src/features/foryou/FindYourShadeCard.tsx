// src/features/foryou/FindYourShadeCard.tsx
// Empty-state for the "Picked for your shade" rail. When there is no shade yet
// (a real, non-demo session that hasn't scanned), resolveForYouProfile() returns
// undefined and the ranked rail has nothing to show. Rather than let that section
// silently vanish, this card takes its place: a calm prompt that routes into the
// shade-match flow. It reuses the Mist glass surface and the screen's locked
// brand-green action colour, so it reads as part of the same shelf, not a bolt-on.
//
// Compliance: the button routes to '/scan-gate' (the age-gate + consent chain),
// NEVER directly to '/scan'. Copy is cosmetic only (foundation shade matching),
// with no medical / efficacy / accuracy claim.
import { View } from 'react-native';
import { GlassCard, Subheading, Body, PressableScale, Caption } from '../../components/ui';

interface FindYourShadeCardProps {
  /** Routes into the shade-match flow. The caller wires router.push('/scan-gate'). */
  onFindShade: () => void;
}

/** "Find your shade" prompt shown in place of the ranked rail before a shade exists. */
export function FindYourShadeCard({ onFindShade }: FindYourShadeCardProps) {
  return (
    <View className="gap-3" testID="find-your-shade">
      <Subheading accessibilityRole="header">Your products</Subheading>
      <GlassCard className="gap-2 p-5" flat>
        <Subheading>Find your shade</Subheading>
        <Body className="text-ink-soft">
          Match your foundation shade to unlock picks chosen for your tone.
        </Body>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Find your shade"
          accessibilityHint="Opens the shade scan"
          onPress={onFindShade}
          testID="find-your-shade-cta"
          className="mt-1 self-start"
        >
          <View className="rounded-full bg-brand-green px-5 py-2.5">
            <Caption className="font-semibold text-white">Match my shade</Caption>
          </View>
        </PressableScale>
      </GlassCard>
    </View>
  );
}
