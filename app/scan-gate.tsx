import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, HEADER_CLEARANCE, Eyebrow, Heading, Body, PrimaryButton, PressableScale, Disclaimer } from '../src/components/ui';

/**
 * Scan gate (B1) — the on-device-privacy reassurance shown before the camera scan.
 * Cosmetic framing only, no personalized strings. The shade read runs on-device and
 * the image never leaves the phone (CLAUDE.md §1/§3). "Enable camera" heads to the
 * scan; "Skip for now" drops back to the tabs.
 */
export default function ScanGateScreen() {
  const router = useRouter();

  // topGap clears the transparent floating Stack header (the back button) so the eyebrow
  // never renders under it -- matching the age-gate / consent gate screens. The disclaimer
  // is grouped with the CTAs as a footer so the screen reads as two balanced anchors (intro
  // at top, fine print + actions at the bottom) instead of a top-heavy stack with dead space.
  return (
    <Screen className="px-6" topGap={HEADER_CLEARANCE}>
      <View className="flex-1">
        <View className="gap-3">
          <Eyebrow>Before we scan</Eyebrow>
          <Heading>Your scan stays on your device</Heading>
          <Body className="text-ink-soft">
            Your shade analysis runs right here on your phone. Your photo is never uploaded and
            never leaves your device.
          </Body>
        </View>

        <View className="mt-auto gap-6">
          <Disclaimer />
          <View className="gap-4 pb-2">
            <PrimaryButton label="Enable camera" onPress={() => router.replace('/scan')} />
            <PressableScale accessibilityRole="button" onPress={() => router.replace('/(tabs)')}>
              <Body className="text-center text-ink-faint">Skip for now</Body>
            </PressableScale>
          </View>
        </View>
      </View>
    </Screen>
  );
}
