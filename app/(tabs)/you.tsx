import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  Display,
  GlassCard,
  ListRow,
  Disclaimer,
  TAB_BAR_CLEARANCE,
  Rise,
} from '../../src/components/ui';

/**
 * You — profile & controls. Surfaces the previously-orphaned data-rights and legal
 * screens (both are reachability requirements: data deletion per CLAUDE.md §1, and
 * policies must be reachable before a scan per the build order).
 */
export default function YouScreen() {
  const router = useRouter();
  return (
    <Screen className="px-6" topGap={32} bottomGap={TAB_BAR_CLEARANCE}>
      <Rise>
        <View className="items-center mt-3 mb-8">
          <View className="h-20 w-20 rounded-full bg-mist-300 mb-4" />
          <Display className="text-[28px]">You</Display>
        </View>
      </Rise>

      <View className="gap-3">
      <Rise index={1}>
      <GlassCard flat className="px-6 py-1" radius={22}>
        <ListRow
          label="Your Data"
          onPress={() => router.push('/data')}
        />
      </GlassCard>
      </Rise>
      <Rise index={2}>
      <GlassCard flat className="px-6 py-1" radius={22}>
        <ListRow
          label="Privacy & Policies"
          onPress={() => router.push('/policies')}
        />
      </GlassCard>
      </Rise>
      <Rise index={3}>
      <GlassCard flat className="px-6 py-1" radius={22}>
        <ListRow label="Notifications" onPress={() => {}} />
      </GlassCard>
      </Rise>
      <Rise index={4}>
      <GlassCard flat className="px-6 py-1" radius={22}>
        <ListRow label="Delete everything" destructive hideChevron onPress={() => router.push('/data')} />
      </GlassCard>
      </Rise>
      </View>

      <Rise index={5}>
        <View className="mt-7"><Disclaimer /></View>
      </Rise>
    </Screen>
  );
}
