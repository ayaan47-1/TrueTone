// src/features/foryou/SeasonalSheet.tsx
// The "Seasonal" quick action (video t-01, badged NEW): a glass sheet inviting a rescan as
// the seasons change. Deliberately no progress numbers — seasonal scans are not tracked yet.
import { Text, View } from 'react-native';
import { Body, GlassSheet, PressableScale, PrimaryButton, Eyebrow } from '../../components/ui';

interface SeasonalSheetProps {
  onScan: () => void;
  onClose: () => void;
}

export function SeasonalSheet({ onScan, onClose }: SeasonalSheetProps) {
  return (
    <GlassSheet onClose={onClose} align="bottom" className="p-6">
      <Eyebrow>Seasonal</Eyebrow>
      <Text accessibilityRole="header" className="mt-2 font-display text-[22px] leading-[27px] text-ink">
        Seasonal shade check
      </Text>
      <Body className="mt-2 text-ink-soft">
        Your skin tone can look a little different from summer to winter. Rescan each season to keep your
        matches current.
      </Body>
      <View className="mt-5 gap-2">
        <PrimaryButton label="Scan again" onPress={onScan} />
        <PressableScale accessibilityRole="button" accessibilityLabel="Not now" onPress={onClose} className="items-center py-3">
          <Text className="font-body-semibold text-[14px] text-ink-soft">Not now</Text>
        </PressableScale>
      </View>
    </GlassSheet>
  );
}
