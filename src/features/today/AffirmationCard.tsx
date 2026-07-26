import { Pressable, Share, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Display, Caption } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { pickAffirmation } from './affirmations';

/**
 * The daily affirmation hero — a soft mauve→rose gradient card with a rotating
 * (deterministic-by-day) wellness affirmation and a Share action. Pure
 * cosmetic/general-wellness content (CLAUDE.md §1).
 */
export function AffirmationCard({ today = new Date() }: { today?: Date }) {
  const text = pickAffirmation(today);
  const onShare = () => {
    void Share.share({ message: `${text}\n\n— TrueTone` });
  };
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[palette.mist300, palette.mist200]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Caption className="text-ink-muted mb-3 font-semibold uppercase tracking-[1.4px]">Today&apos;s note</Caption>
      <Display className="text-[22px] leading-[30px] text-ink">{text}</Display>
      <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={onShare} style={styles.share}>
        <Caption className="font-semibold text-sage">Share note</Caption>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, overflow: 'hidden', padding: 24 },
  share: { marginTop: 14, alignSelf: 'flex-start', paddingVertical: 6 },
});
