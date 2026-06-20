import { View, StyleSheet, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { mistGradient, palette } from '../../theme/tokens';

/**
 * Full-bleed "mist" atmosphere: a soft lavender→rose gradient mesh with a few
 * out-of-frame colour blooms that give the glass surfaces something to refract.
 * Render it as the first child of a screen and stack content above it.
 */
export function MistBackground({ children, style, ...rest }: ViewProps) {
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
      <View pointerEvents="none" style={[styles.bloom, styles.bloomRose]} />
      <View pointerEvents="none" style={[styles.bloom, styles.bloomMauve]} />
      <View pointerEvents="none" style={[styles.bloom, styles.bloomMist]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.mist100 },
  bloom: { position: 'absolute', borderRadius: 9999 },
  bloomRose: {
    width: 360,
    height: 360,
    top: -120,
    right: -110,
    backgroundColor: palette.rose200,
    opacity: 0.5,
  },
  bloomMauve: {
    width: 300,
    height: 300,
    bottom: -90,
    left: -120,
    backgroundColor: palette.mauve400,
    opacity: 0.18,
  },
  bloomMist: {
    width: 420,
    height: 420,
    bottom: 40,
    right: -180,
    backgroundColor: palette.mist300,
    opacity: 0.4,
  },
});
