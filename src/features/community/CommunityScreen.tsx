import { View } from 'react-native';
import { Screen, Display, Body, GlassCard, TAB_BAR_CLEARANCE, Rise } from '../../components/ui';

/**
 * Community tab entry point. Minimal branded placeholder — the Social agent owns this
 * file (and the rest of `src/features/community/**`) and will replace the body with
 * real profiles/cards/feed data without touching routing (Commerce keeps
 * `app/(tabs)/community.tsx` and the tab bar). Public seam: no props.
 */
export function CommunityScreen() {
  return (
    <Screen className="px-6" topGap={32} bottomGap={TAB_BAR_CLEARANCE}>
      <Rise>
        <View className="items-center mt-3 mb-8">
          <View className="h-20 w-20 rounded-full bg-mist-300 mb-4" />
          <Display className="text-[28px]">Community</Display>
        </View>
      </Rise>

      <Rise index={1}>
        <GlassCard flat className="px-6 py-8 items-center" radius={22}>
          <Body className="text-center text-ink-muted">Community is on its way.</Body>
        </GlassCard>
      </Rise>
    </Screen>
  );
}
