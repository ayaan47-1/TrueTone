import { View } from 'react-native';
import {
  Screen,
  Display,
  Eyebrow,
  Body,
  GlassCard,
  Caption,
  TAB_BAR_CLEARANCE,
} from '../../src/components/ui';

/**
 * Trend tab — within-user progress over time. Phase B is a shell; Phase D wires in
 * the scan history, honest trend arrows, and the (flag-gated) skin-age via the
 * existing AgeTrendCard.
 */
export default function TrendScreen() {
  return (
    <Screen className="px-6" topGap={8} bottomGap={TAB_BAR_CLEARANCE}>
      <View className="gap-2 mt-2 mb-6">
        <Eyebrow>Your progress</Eyebrow>
        <Display className="text-[44px]">Trend</Display>
        <Body className="text-ink-soft">How your skin&rsquo;s appearance is changing, scan over scan.</Body>
      </View>

      <GlassCard className="px-6 py-8 items-center" radius={28}>
        <Caption className="text-center text-ink-muted">
          Take a few scans to see your trend here.
        </Caption>
      </GlassCard>
    </Screen>
  );
}
