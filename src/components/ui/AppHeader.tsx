import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Subheading } from './Typography';
import { useInsets } from './use-insets';
import { palette } from '../../theme/tokens';

/** Fixed width/height for the leading and trailing slots, and the min tap target for onBack. */
export const APP_HEADER_CONTROL_SIZE = 48;

/** Base top padding added above the safe-area inset. */
const HEADER_TOP_GAP = 8;

interface AppHeaderProps {
  title: string;
  /** Renders a default 48pt back chevron in the leading slot when no custom `leading` is given. */
  onBack?: () => void;
  /** Custom leading slot content; takes precedence over the default back button. */
  leading?: ReactNode;
  /** Custom trailing slot content. */
  trailing?: ReactNode;
  /** Overrides the header's accessibility label (defaults to `title`). */
  accessibilityLabel?: string;
}

/**
 * Shared screen header: safe-area-aware top spacing, a centered single-line title, and
 * fixed-width leading/trailing slots so a long title can never collide with either icon —
 * it truncates in the space between them instead.
 */
export function AppHeader({ title, onBack, leading, trailing, accessibilityLabel }: AppHeaderProps) {
  const insets = useInsets();
  const leadingContent = leading ?? (onBack ? <BackButton onPress={onBack} /> : null);

  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[styles.container, { paddingTop: insets.top + HEADER_TOP_GAP }]}
    >
      <View style={styles.slot}>{leadingContent}</View>
      <Subheading numberOfLines={1} style={styles.title}>
        {title}
      </Subheading>
      <View style={styles.slot}>{trailing}</View>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} style={styles.backButton}>
      <View style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  slot: {
    width: APP_HEADER_CONTROL_SIZE,
    height: APP_HEADER_CONTROL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: APP_HEADER_CONTROL_SIZE,
    height: APP_HEADER_CONTROL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bottom-left corner rotated 45° reads as a left-pointing chevron ("<").
  chevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: palette.ink,
    transform: [{ rotate: '45deg' }],
  },
});
