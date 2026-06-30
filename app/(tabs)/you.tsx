import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  Display,
  Eyebrow,
  GlassCard,
  ListRow,
  Disclaimer,
  TAB_BAR_CLEARANCE,
} from '../../src/components/ui';

/**
 * You — profile & controls. Surfaces the previously-orphaned data-rights and legal
 * screens (both are reachability requirements: data deletion per CLAUDE.md §1, and
 * policies must be reachable before a scan per the build order).
 */
export default function YouScreen() {
  const router = useRouter();
  return (
    <Screen className="px-6" topGap={8} bottomGap={TAB_BAR_CLEARANCE}>
      <View className="gap-2 mt-2 mb-6">
        <Eyebrow>Your account</Eyebrow>
        <Display className="text-[44px]">You</Display>
      </View>

      <GlassCard className="px-6 py-1 mb-6" radius={28}>
        <ListRow
          label="Your Data"
          caption="View, export, or delete everything"
          onPress={() => router.push('/data')}
        />
        <View className="h-px bg-ink-faint/30" />
        <ListRow
          label="Privacy & Policies"
          caption="Privacy, Terms, Biometric & retention"
          onPress={() => router.push('/policies')}
        />
      </GlassCard>

      <Disclaimer />
    </Screen>
  );
}
