import { View, StyleSheet } from 'react-native';
import { GlassCard, Subheading, Body, Caption, PressableScale } from '../../components/ui';
import { palette } from '../../theme/tokens';

export interface FinishYourLookItem {
  id: string;
  name: string;
  /** Preformatted price string, e.g. "$18". */
  price: string;
}

export interface FinishYourLookProps {
  items: readonly FinishYourLookItem[];
  /** Preformatted live total, e.g. "$54". Owned by the parent. */
  total: string;
  /** Optional per-item add affordance. */
  onAdd?: (id: string) => void;
}

/**
 * Today-home "Finish your look" (SHELL). A hairline list of add-on makeup items
 * with a live running total supplied by the parent. Props-driven only — no cart
 * or store wiring. Cosmetic copy.
 */
export function FinishYourLook({ items, total, onAdd }: FinishYourLookProps) {
  return (
    <GlassCard className="px-5 py-4">
      <View className="flex-row items-center justify-between">
        <Subheading className="text-ink">Finish your look</Subheading>
        <Caption className="text-ink-soft font-semibold">{total}</Caption>
      </View>
      <View className="mt-2">
        {items.map((item, i) => (
          <View
            key={item.id}
            style={[styles.row, i > 0 ? styles.hairline : null]}
          >
            <Body className="text-ink flex-1">{item.name}</Body>
            <Caption className="text-ink-soft mr-3">{item.price}</Caption>
            {onAdd ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.name}`}
                onPress={() => onAdd(item.id)}
              >
                <Caption className="text-brand-green font-semibold">Add</Caption>
              </PressableScale>
            ) : null}
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  hairline: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.inkFaint },
});
