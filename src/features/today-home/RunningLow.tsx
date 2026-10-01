import { Text, View } from 'react-native';
import { GlassCard, Subheading, Body, Caption, PressableScale } from '../../components/ui';
import { palette } from '../../theme/tokens';
import type { Product } from '../match/match-types';
import { ProductArt } from '../shop/ProductArt';

export interface RunningLowItem {
  id: string;
  name: string;
  /** Optional cosmetic note, e.g. "Almost out". */
  note?: string;
  /** Tints the note clay when the item is nearly gone. */
  urgent?: boolean;
  /** When present, the row shows the product's art (v3 video t-06). */
  product?: Product;
}

export interface RunningLowProps {
  items: readonly RunningLowItem[];
  subtitle?: string;
  /** When present, each row gets a "Reorder" button that passes back the item id. */
  onReorder?: (id: string) => void;
  /** Small footnote under the list, e.g. a sample-data label. */
  footnote?: string;
}

const hairline = { borderTopWidth: 1, borderTopColor: 'rgba(168,159,143,0.18)' } as const;

/**
 * Today-home "Running low". A quiet list of makeup items the user may want to restock,
 * optionally with product art and a Reorder button (kit RunningLow3). Props-driven only —
 * no inventory tracking; the caller supplies items. Gentle empty state when nothing is low.
 */
export function RunningLow({ items, subtitle, onReorder, footnote }: RunningLowProps) {
  return (
    <GlassCard radius={26} className="px-[18px] pb-2 pt-4">
      <Subheading className="text-ink">Running low</Subheading>
      {subtitle ? <Caption className="text-ink-muted mt-0.5">{subtitle}</Caption> : null}
      {items.length === 0 ? (
        <Body className="text-ink-soft mt-2 mb-2">You&apos;re all stocked up.</Body>
      ) : (
        <View className="mt-2">
          {items.map((item, i) => (
            <View key={item.id} className="flex-row items-center gap-3 py-2.5" style={i > 0 ? hairline : undefined}>
              {item.product ? (
                <View testID={`running-low-art-${item.id}`} style={{ width: 48 }}>
                  <ProductArt product={item.product} height={48} radius={14} />
                </View>
              ) : null}
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-body-semibold text-[14px] text-ink">
                  {item.name}
                </Text>
                {item.note ? (
                  <Caption style={{ color: item.urgent ? palette.clayInk : palette.inkMuted }}>{item.note}</Caption>
                ) : null}
              </View>
              {onReorder ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Reorder ${item.name}`}
                  onPress={() => onReorder(item.id)}
                  className="rounded-full bg-brand-tint px-3.5 py-2"
                >
                  <Text className="font-body-semibold text-[12px]" style={{ color: palette.sageInk }}>
                    Reorder
                  </Text>
                </PressableScale>
              ) : null}
            </View>
          ))}
        </View>
      )}
      {footnote ? <Caption className="text-ink-faint mb-1.5 mt-1 text-[11px]">{footnote}</Caption> : null}
    </GlassCard>
  );
}
