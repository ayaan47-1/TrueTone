import { View } from 'react-native';
import { Caption, Body, GlassCard } from '../../components/ui';

export interface ShadeTwinsProps {
  /** Number of other users matched to a similar shade. */
  count: number;
}

/**
 * Today-home "Shade twins" teaser row (SHELL). A small card teasing how many
 * other users share a similar matched shade. Props-driven only.
 */
export function ShadeTwins({ count }: ShadeTwinsProps) {
  return (
    <GlassCard className="p-4 flex-row items-center justify-between">
      <View>
        <Body className="text-ink-soft font-semibold">Shade twins</Body>
        <Caption className="text-ink-faint mt-1">
          {count} {count === 1 ? 'person shares' : 'people share'} your shade match
        </Caption>
      </View>
    </GlassCard>
  );
}
