import { View } from 'react-native';
import { Eyebrow } from './Typography';

/**
 * A centered, all-caps section label flanked by hairline dividers — the
 * "Daily Plan" / "Skin Diary" rhythm from the reference, in the Mist palette.
 */
export function SectionLabel({ children }: { children: string }) {
  return (
    <View className="flex-row items-center my-3">
      <View className="flex-1 h-px bg-ink-faint/40" />
      <Eyebrow className="mx-3 text-ink-muted">{children}</Eyebrow>
      <View className="flex-1 h-px bg-ink-faint/40" />
    </View>
  );
}
