import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass, softShadow } from '../../theme/tokens';

interface GlassCardProps extends ViewProps {
  /** Tailwind classes for the inner padded content area. */
  className?: string;
  /** Blur strength (0–100). Lower = more translucent. */
  intensity?: number;
  /** Corner radius in px. */
  radius?: number;
  /** Drop the mauve elevation (e.g. for flat list rows). */
  flat?: boolean;
  /** Extra style on the outer (shadow) wrapper. */
  style?: StyleProp<ViewStyle>;
}

/**
 * A frosted liquid-glass panel: real backdrop blur, a translucent white fill,
 * a hairline highlight edge, and a soft mauve shadow. The blur is clipped to the
 * radius via an inner `overflow: hidden` layer; the shadow lives on the wrapper
 * so it isn't clipped away.
 */
export function GlassCard({
  children,
  className,
  intensity = 36,
  radius = 30,
  flat = false,
  style,
  ...rest
}: GlassCardProps) {
  return (
    <View style={[{ borderRadius: radius }, flat ? null : softShadow, style]} {...rest}>
      <BlurView
        intensity={intensity}
        tint="light"
        style={[styles.surface, { borderRadius: radius }]}
      >
        <View className={className}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: glass.edge,
    backgroundColor: glass.fill,
  },
});
