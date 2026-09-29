import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { hasLiquidGlass } from './liquid-glass';

interface GlassSurfaceProps extends ViewProps {
  /** Shape + layout, applied on both paths (include borderRadius: it shapes the native glass). */
  style?: StyleProp<ViewStyle>;
  /** Fill/border for the Quiet Glass fallback only; never painted over native glass. */
  fallbackStyle?: StyleProp<ViewStyle>;
  /** Fallback blur strength (0–100). 0 = fill-only, no blur layer. */
  intensity?: number;
  /** Native glass tint (e.g. a state colour on a status chip). */
  tintColor?: string;
  /** Native press response (shimmer/scale) for tappable controls. */
  interactive?: boolean;
}

/**
 * Glass for floating CONTROLS (back button, bag button, capture status chips) — not for
 * content cards, per Apple's guidance that glass belongs to the navigation/control layer.
 * iOS 26+: Apple's native Liquid Glass via expo-glass-effect. Everywhere else: the Quiet Glass
 * BlurView + translucent fill it replaces.
 */
export function GlassSurface({
  children,
  style,
  fallbackStyle,
  intensity = 30,
  tintColor,
  interactive = false,
  ...rest
}: GlassSurfaceProps) {
  if (hasLiquidGlass()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={tintColor}
        isInteractive={interactive}
        style={style}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[style, fallbackStyle, styles.clip]} {...rest}>
      {intensity > 0 ? (
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
