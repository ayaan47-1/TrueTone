import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { GlassCard } from './GlassCard';
import { useInsets } from './use-insets';
import { sheetMaxWidth } from './use-responsive';
import { glass } from '../../theme/tokens';

interface GlassSheetProps {
  children: ReactNode;
  /** When provided, tapping the dim backdrop (and the ✕) dismisses the sheet.
   *  Omit for mandatory gates (age, consent) so the sheet can't be escaped. */
  onClose?: () => void;
  /** Tailwind classes for the padded content inside the glass. */
  className?: string;
  /** Vertical placement of the sheet. */
  align?: 'center' | 'bottom';
}

/**
 * A modal-style frosted glass popup. Dims the branded page behind it, then
 * springs a `GlassCard` in. Used for the age gate, the biometric consent, and
 * the policy reader. Content/accessibility live with the caller so compliance
 * copy and testIDs are never owned by this shell.
 */
export function GlassSheet({ children, onClose, className, align = 'center' }: GlassSheetProps) {
  const insets = useInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill}>
      <AnimatedBackdrop onPress={onClose} />
      <View
        pointerEvents="box-none"
        style={[
          styles.stage,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
          align === 'bottom' ? styles.stageBottom : styles.stageCenter,
        ]}
      >
        <Animated.View
          entering={FadeInDown.springify().damping(20).mass(0.9)}
          style={[styles.sheetWrap, { maxWidth: sheetMaxWidth(width) }]}
        >
          <GlassCard intensity={50} radius={36} className={className}>
            {onClose ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                hitSlop={12}
                style={styles.close}
              >
                <View style={styles.closeDot} />
              </Pressable>
            ) : null}
            {children}
          </GlassCard>
        </Animated.View>
      </View>
    </View>
  );
}

function AnimatedBackdrop({ onPress }: { onPress?: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        disabled={!onPress}
        onPress={onPress}
        style={[StyleSheet.absoluteFill, { backgroundColor: glass.backdrop }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, paddingHorizontal: 20 },
  stageCenter: { justifyContent: 'center' },
  stageBottom: { justifyContent: 'flex-end' },
  sheetWrap: { width: '100%', alignSelf: 'center' },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    zIndex: 2,
  },
  closeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: glass.backdrop },
});
