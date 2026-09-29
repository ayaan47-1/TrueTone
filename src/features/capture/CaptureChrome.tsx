// src/features/capture/CaptureChrome.tsx
//
// Presentational chrome for the guided capture screen, matching the v3 walkthrough (frame t-18):
// a warm dark backdrop behind the camera, a Liquid Glass hint pill and a Liquid Glass Cancel pill.
// Pure presentation — nothing here reads the camera, the frame metrics or the quality gate; the
// caller passes the hint text and pass state in.
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassSurface } from '../../components/ui';
import { fonts, palette } from '../../theme/tokens';

/** Sage tint for a passed state on native glass (same as the check chips). */
export const GLASS_OK_TINT = 'rgba(47,125,82,0.35)';

// The kit's radial glow (#3a322b at ~42% height fading to #111) as a vertical gradient; the
// camera preview covers it once frames arrive, so it only shows while the camera spins up.
const BACKDROP_COLORS = ['#1a1714', '#3a322b', palette.camera] as const;
const BACKDROP_STOPS = [0, 0.42, 1] as const;

export function CaptureBackdrop() {
  return (
    <LinearGradient
      testID="capture-backdrop"
      colors={BACKDROP_COLORS}
      locations={BACKDROP_STOPS}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

export function GlassHintPill({ text, pass }: { text: string; pass: boolean }) {
  return (
    <GlassSurface
      testID="capture-hint-pill"
      intensity={0}
      tintColor={pass ? GLASS_OK_TINT : undefined}
      style={styles.hintPill}
      fallbackStyle={[styles.pillFill, pass && styles.hintPillPass]}
    >
      <Text style={[styles.hintText, pass && styles.hintTextPass]}>{text}</Text>
    </GlassSurface>
  );
}

export function GlassCancelButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Cancel"
      accessibilityState={{ disabled }}
    >
      {/* Not `interactive`: native interactive glass can take the touch itself and would keep
          reacting while the Pressable is disabled during the countdown. */}
      <GlassSurface intensity={0} style={styles.cancelPill} fallbackStyle={styles.pillFill}>
        <Text style={[styles.cancelText, disabled && styles.cancelTextDim]}>Cancel</Text>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hintPill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  cancelPill: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999 },
  // Quiet Glass fallback fill (iOS 26+ renders native Liquid Glass instead).
  pillFill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  hintPillPass: { backgroundColor: 'rgba(47,125,82,0.26)', borderColor: 'rgba(47,125,82,0.5)' },
  hintText: { color: 'rgba(255,255,255,0.92)', fontFamily: fonts.bodyMedium, fontSize: 15 },
  hintTextPass: { color: palette.white },
  cancelText: { color: palette.white, fontFamily: fonts.bodySemibold, fontSize: 15 },
  cancelTextDim: { color: 'rgba(255,255,255,0.35)' },
});
