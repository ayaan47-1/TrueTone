import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Caption, Display, Body, PressableScale } from '../../components/ui';
import { palette } from '../../theme/tokens';

export interface ShadeCardProps {
  /** The matched shade name, e.g. "Warm Almond". Only render post-scan. */
  shadeName: string;
  /** Qualitative descriptors — undertone / depth / finish. No numbers. */
  undertone?: string;
  depth?: string;
  finish?: string;
  /** Two-stop warm gradient standing in for the shade swatch. */
  gradientColors?: readonly [string, string];
  /** Optional "Rescan" affordance. */
  onRescan?: () => void;
}

/**
 * Today-home shade hero (SHELL). A warm shade-gradient card showing the user's
 * current matched makeup shade plus qualitative undertone/depth/finish chips and
 * an optional "Rescan" link. Props-driven only — no store/route wiring. Cosmetic
 * copy: this describes a MAKEUP SHADE, never skin or health.
 */
export function ShadeCard({
  shadeName,
  undertone,
  depth,
  finish,
  gradientColors = [palette.mist400, palette.clay],
  onRescan,
}: ShadeCardProps) {
  const descriptors = [undertone, depth, finish].filter(Boolean) as string[];
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={gradientColors as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Caption className="text-white/80 mb-2 font-semibold uppercase tracking-[1.4px]">Your shade</Caption>
      <Display className="text-[26px] leading-[32px] text-white">{shadeName}</Display>
      {descriptors.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 mt-4">
          {descriptors.map((d) => (
            <View key={d} className="rounded-full bg-white/20 px-3 py-1">
              <Caption className="text-white">{d}</Caption>
            </View>
          ))}
        </View>
      ) : null}
      {onRescan ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Rescan"
          onPress={onRescan}
          style={styles.rescan}
        >
          <Body className="text-white font-semibold">Rescan</Body>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, overflow: 'hidden', padding: 24 },
  rescan: { marginTop: 18, alignSelf: 'flex-start', paddingVertical: 6 },
});
