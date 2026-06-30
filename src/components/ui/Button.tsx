import { Pressable, Text, View, StyleSheet, type PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { palette, glass, softShadow } from '../../theme/tokens';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  /** Visual weight. */
  variant?: 'primary' | 'glass' | 'ghost';
  /** Stretch to fill the parent row/column. */
  fullWidth?: boolean;
}

/**
 * The "Mist" button family.
 * - primary: a deep-mauve gradient pill with mauve elevation (the one CTA).
 * - glass:   a frosted pill for secondary actions over the mist background.
 * - ghost:   a quiet hairline pill for tertiary / destructive-adjacent actions.
 */
export function PrimaryButton({ label, variant = 'primary', fullWidth, disabled, ...rest }: ButtonProps) {
  const block = fullWidth ? styles.block : null;

  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        style={({ pressed }) => [
          styles.pill,
          block,
          softShadow,
          { opacity: disabled ? 0.45 : pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        ]}
        {...rest}
      >
        {/* Clip the gradient to the pill radius in its own layer so the outer
            Pressable can still cast the (un-clipped) mauve shadow. */}
        <View style={styles.clip}>
          <LinearGradient
            colors={[palette.mauve400, palette.mauve600]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <Text
          numberOfLines={1}
          className="font-body-semibold text-[15px] tracking-[0.3px] text-white text-center"
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  if (variant === 'glass') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        style={({ pressed }) => [
          styles.pill,
          block,
          { overflow: 'hidden', opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        ]}
        {...rest}
      >
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.glassFill]} />
        <Text className="font-body-semibold text-[15px] text-mauve-600">{label}</Text>
      </Pressable>
    );
  }

  // ghost
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        styles.ghost,
        block,
        { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
      ]}
      {...rest}
    >
      <Text className="font-body-medium text-[15px] text-ink-soft">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  block: { alignSelf: 'stretch', width: '100%' },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, overflow: 'hidden' },
  glassFill: {
    backgroundColor: glass.fillStrong,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: glass.edge,
  },
  ghost: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(124,77,139,0.30)',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
