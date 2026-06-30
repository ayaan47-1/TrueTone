import { View, StyleSheet, useWindowDimensions, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { mistGradient, palette } from '../../theme/tokens';
import { bloomMetrics } from './use-responsive';

/**
 * Full-bleed "mist" atmosphere: a soft lavender→rose gradient mesh with a few
 * out-of-frame colour blooms that give the glass surfaces something to refract.
 * Render it as the first child of a screen and stack content above it.
 *
 * Bloom sizes/offsets scale with the viewport (via `bloomMetrics`) so they keep
 * their proportions on narrow folded and near-square unfolded screens instead of
 * vanishing or crowding the way fixed pixel sizes did.
 */
export function MistBackground({ children, style, ...rest }: ViewProps) {
  const { width, height } = useWindowDimensions();
  const bloom = bloomMetrics({ width, height });
  return (
    <View style={[styles.root, style]} {...rest}>
      <LinearGradient
        colors={mistGradient.colors}
        locations={mistGradient.locations}
        start={mistGradient.start}
        end={mistGradient.end}
        style={StyleSheet.absoluteFill}
      />
      {/* Decorative blooms — purely atmospheric, never interactive. */}
      <View
        pointerEvents="none"
        style={[
          styles.bloom,
          {
            width: bloom.rose,
            height: bloom.rose,
            top: -bloom.rose * 0.33,
            right: -bloom.rose * 0.3,
            backgroundColor: palette.rose200,
            opacity: 0.5,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.bloom,
          {
            width: bloom.mauve,
            height: bloom.mauve,
            bottom: -bloom.mauve * 0.3,
            left: -bloom.mauve * 0.4,
            backgroundColor: palette.mauve400,
            opacity: 0.18,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.bloom,
          {
            width: bloom.mist,
            height: bloom.mist,
            bottom: bloom.mist * 0.1,
            right: -bloom.mist * 0.43,
            backgroundColor: palette.mist300,
            opacity: 0.4,
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.mist100 },
  bloom: { position: 'absolute', borderRadius: 9999 },
});
