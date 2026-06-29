import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Body, Caption } from './Typography';
import { palette } from '../../theme/tokens';

interface ListRowProps {
  label: string;
  onPress: () => void;
  /** Optional leading glyph (e.g. a tab-style icon). */
  icon?: ReactNode;
  /** Optional secondary line under the label. */
  caption?: string;
  /** Hide the trailing chevron (e.g. for a terminal action). */
  hideChevron?: boolean;
}

/**
 * A tappable settings/navigation row for the "You" tab and similar lists:
 * optional leading icon, a label (+ optional caption), and a trailing chevron.
 * Glassy hairline styling that sits inside a GlassCard list.
 */
export function ListRow({ label, onPress, icon, caption, hideChevron }: ListRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.row}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.text}>
        <Body className="text-ink">{label}</Body>
        {caption ? <Caption className="text-ink-muted">{caption}</Caption> : null}
      </View>
      {!hideChevron ? <View style={styles.chevron} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  icon: { width: 24, alignItems: 'center' },
  text: { flex: 1, gap: 1 },
  // A simple chevron drawn as a rotated open corner (matches the icon-free motif).
  chevron: {
    width: 9,
    height: 9,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: palette.inkFaint,
    transform: [{ rotate: '45deg' }],
  },
});
