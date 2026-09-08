import { View, StyleSheet } from 'react-native';
import { GlassCard, Subheading, Body, Caption } from '../../components/ui';
import { palette } from '../../theme/tokens';

export interface RunningLowItem {
  id: string;
  name: string;
  /** Optional cosmetic note, e.g. "Almost out". */
  note?: string;
}

export interface RunningLowProps {
  items: readonly RunningLowItem[];
}

/**
 * Today-home "Running low" (SHELL). A quiet list of makeup items the user may
 * want to restock. Props-driven only — no inventory tracking or store wiring.
 * Shows a gentle empty state when nothing is low. Cosmetic copy.
 */
export function RunningLow({ items }: RunningLowProps) {
  return (
    <GlassCard className="px-5 py-4">
      <Subheading className="text-ink">Running low</Subheading>
      {items.length === 0 ? (
        <Body className="text-ink-soft mt-2">You&apos;re all stocked up.</Body>
      ) : (
        <View className="mt-2">
          {items.map((item, i) => (
            <View key={item.id} style={[styles.row, i > 0 ? styles.hairline : null]}>
              <Body className="text-ink flex-1">{item.name}</Body>
              {item.note ? <Caption className="text-ink-soft">{item.note}</Caption> : null}
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  hairline: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.inkFaint },
});
