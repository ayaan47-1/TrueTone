import { View, StyleSheet } from 'react-native';
import { Caption, Subheading, Body, PressableScale } from '../../components/ui';
import { palette } from '../../theme/tokens';

export interface TodaysPickProps {
  /** The pick copy, revealed on tap (e.g. "Soft rose blush"). */
  pickLabel: string;
  /** Whether the pick is currently revealed. */
  revealed: boolean;
  /** Tap-to-reveal handler. */
  onReveal: () => void;
}

/**
 * Today-home "Today's pick" (SHELL). A dark, tap-to-reveal card that keeps one
 * curated makeup pick hidden behind a tap, with an "until midnight" freshness
 * caption. Props-driven only — the parent owns the revealed state. Cosmetic copy.
 */
export function TodaysPick({ pickLabel, revealed, onReveal }: TodaysPickProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Today's pick"
      accessibilityState={{ expanded: revealed }}
      onPress={onReveal}
    >
      <View style={styles.card}>
        <Caption className="text-white/60 font-semibold uppercase tracking-[1.4px]">
          Today&apos;s pick · until midnight
        </Caption>
        {revealed ? (
          <Subheading className="text-white mt-3">{pickLabel}</Subheading>
        ) : (
          <Body className="text-white/80 mt-3">Tap to reveal</Body>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, padding: 24, backgroundColor: palette.ink },
});
