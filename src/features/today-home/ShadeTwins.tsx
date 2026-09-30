import { View } from 'react-native';
import { Caption, Body, GlassCard, PressableScale } from '../../components/ui';
import { fitzpatrick, palette } from '../../theme/tokens';
import { ChevronGlyph } from '../shop/shop-icons';

export interface ShadeTwinsProps {
  /** Number of other users matched to a similar shade. */
  count: number;
  /** When present the card is a button (e.g. opens Community) — kit ShadeTwins3. */
  onPress?: () => void;
}

/**
 * Today-home "Shade twins" teaser row. A small card with a stack of tone swatches and
 * how many other users share a similar matched shade. Props-driven only.
 */
export function ShadeTwins({ count, onPress }: ShadeTwinsProps) {
  const card = (
    <GlassCard radius={22} className="p-4 flex-row items-center gap-3.5">
      <View className="flex-row">
        {fitzpatrick.slice(1, 5).map((c, i) => (
          <View
            key={c}
            style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: 2, borderColor: palette.white, marginLeft: i ? -10 : 0 }}
          />
        ))}
      </View>
      <View className="flex-1">
        <Body className="text-ink font-semibold">Shade twins</Body>
        <Caption className="text-ink-faint mt-1">
          {count} {count === 1 ? 'person shares' : 'people share'} your shade match
        </Caption>
      </View>
      {onPress ? <ChevronGlyph color={palette.inkMuted} size={8} /> : null}
    </GlassCard>
  );
  if (!onPress) return card;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel="Shade twins" onPress={onPress}>
      {card}
    </PressableScale>
  );
}
