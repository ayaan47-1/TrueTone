import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  Display,
  Eyebrow,
  Body,
  PrimaryButton,
  Disclaimer,
  TAB_BAR_CLEARANCE,
} from '../../src/components/ui';

/**
 * Today — the app home. Phase B establishes the shell (greeting + scan CTA +
 * standing disclaimer); Phase C adds the week strip, skin-feel diary, today's
 * routine summary, and the daily affirmation.
 */
export default function TodayScreen() {
  const router = useRouter();
  return (
    <Screen className="px-6" topGap={8} bottomGap={TAB_BAR_CLEARANCE}>
      <View className="gap-2 mt-2 mb-6">
        <Eyebrow>Skin, honestly</Eyebrow>
        <Display className="text-[44px]">Today</Display>
        <Body className="text-ink-soft">An honest read of how your skin looks today.</Body>
      </View>

      <View className="mb-6">
        <PrimaryButton label="Start your read" fullWidth onPress={() => router.push('/scan')} />
      </View>

      <Disclaimer />
    </Screen>
  );
}
