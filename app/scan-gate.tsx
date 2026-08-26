import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Eyebrow, Heading, Body, PrimaryButton, PressableScale, Disclaimer } from '../src/components/ui';

/**
 * Scan gate (B1) — the on-device-privacy reassurance shown before the camera scan.
 * Cosmetic framing only, no personalized strings. The shade read runs on-device and
 * the image never leaves the phone (CLAUDE.md §1/§3). "Enable camera" heads to the
 * scan; "Skip for now" drops back to the tabs.
 */
export default function ScanGateScreen() {
  const router = useRouter();

  return (
    <Screen className="px-6">
      <View className="flex-1 gap-8 pt-6">
        <View className="gap-3">
          <Eyebrow>Before we scan</Eyebrow>
          <Heading>Your scan stays on your device</Heading>
          <Body className="text-ink-soft">
            Your shade analysis runs right here on your phone. Your photo is never uploaded and
            never leaves your device.
          </Body>
        </View>

        <Disclaimer />

        <View className="mt-auto gap-4 pb-2">
          <PrimaryButton label="Enable camera" onPress={() => router.replace('/scan')} />
          <PressableScale accessibilityRole="button" onPress={() => router.replace('/(tabs)')}>
            <Body className="text-center text-ink-faint">Skip for now</Body>
          </PressableScale>
        </View>
      </View>
    </Screen>
  );
}
