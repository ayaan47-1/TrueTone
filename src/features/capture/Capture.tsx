// src/features/capture/Capture.tsx
//
// Guided front-camera capture. A blocking quality gate (face / light / framing / focus) must pass,
// then the auto-capture state machine holds steady and fires a 3-2-1 countdown before taking the
// photo. The captured file URI is handed to `onCaptured` ONLY — it never leaves the device, logged or
// sent anywhere (CLAUDE.md §3; enforced by scripts/check-no-image-egress.mjs). The on-device read
// (Task 4.2) consumes the URI, derives cosmetic scores, and deletes the image.
//
// Camera + capture use the vision-camera v5 outputs-based API (usePhotoOutput). Quality metrics
// come from useFrameMetrics, backed by real on-device signals — a face detector (presence /
// centering / distance) and a luma frame processor (brightness / sharpness); see that file's header.
//
// Capture goes through capturePhoto() (in-memory) rather than capturePhotoToFile(), because the
// latter writes the raw sensor buffer: on the Fold 7 that is a 3648x2736 LANDSCAPE frame carrying
// EXIF orientation 1, for a portrait selfie. Every consumer downstream then reads a 90-degree
// rotated face, MLKit finds nothing on it, and the read silently scores hair and background.
// writeUprightStill bakes the rotation into the pixels before the file is written — see
// capture-upright.ts. The CaptureMeta it returns is diagnostic only; the read needs nothing from
// it, because the file it hands over is already upright.
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureOvalSize, SHORT_VIEWPORT_THRESHOLD } from '../../components/ui/use-responsive';
import { palette, fonts } from '../../theme/tokens';
import { Screen, GlassCard, Display, Body, PrimaryButton } from '../../components/ui';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { evaluateQuality, THRESHOLDS, type FrameMetrics, type QualityReport } from './quality-gate';
import {
  captureReducer,
  countdownSeconds,
  initialCaptureState,
} from './capture-controller';
import { useFrameMetrics } from './use-frame-metrics';
import { writeUprightStill, type CaptureMeta } from './capture-upright';

const PRIVACY_LINE = 'Analyzed on your device · never leaves your phone · deleted after your read';
// Shipped "pass / ready" accent = the app's brand green (Quiet Glass), so the capture success
// state matches every other positive state in the app instead of an off-brand emerald.
const PASS = palette.sage;
// PASS_GREEN stays a bright emerald for the __DEV__ metrics overlay ONLY (a diagnostic, never shipped).
const PASS_GREEN = '#34d399';
const TICK_MS = 33; // ~30fps drive for the auto-capture state machine

interface CaptureProps {
  /** `meta` is diagnostic — the URI already points at an upright still (see capture-upright.ts). */
  onCaptured: (photoUri: string, meta: CaptureMeta) => void;
  onCancel: () => void;
  /**
   * DEV-ONLY escape hatch: makes the shutter tappable and fires immediately, ignoring the quality
   * gate. Only `app/(dev)/bbox-overlay.tsx` passes it, and it is additionally fenced behind
   * `__DEV__` at the render site, so it cannot reach a release build even if a caller sets it.
   *
   * Why it exists: the overlay verifies REGION GEOMETRY, which does not need a gate-quality frame.
   * Requiring one made the instrument unusable in an ordinarily-lit room and would have pushed us
   * toward loosening THRESHOLDS — a production calibration — to run a diagnostic. This keeps that
   * pressure off the real gate entirely.
   */
  devForceCapture?: boolean;
}

export function Capture({ onCaptured, onCancel, devForceCapture = false }: CaptureProps) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  // Guide oval scales to the viewport so it fits a folded (narrow/short) or unfolded
  // (near-square) screen instead of using fixed pixels that clip. Glow is a touch larger.
  const oval = captureOvalSize(window);
  const glow = { width: Math.round(oval.width * 1.12), height: Math.round(oval.height * 1.12) };
  const isShort = window.height > 0 && window.height < SHORT_VIEWPORT_THRESHOLD;
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  // containerFormat is pinned to 'jpeg' rather than left at 'native': vision-camera documents
  // capturePhoto() as reliable for JPEG only on Android (CameraX's in-memory support for other
  // formats is incomplete), and 'native' resolves to HEIC on iOS, which would make the decode
  // depend on HEIC support being present. Photos land as JPEG on both platforms this way.
  const photoOutput = usePhotoOutput({
    containerFormat: 'jpeg',
    qualityPrioritization: 'balanced',
  });
  const { metrics, lumaOutput } = useFrameMetrics();
  const [state, dispatch] = useReducer(captureReducer, initialCaptureState);

  const quality = evaluateQuality(metrics);
  const allPass = quality.allPass;

  // ---- animations (built-in Animated — no extra babel plugin required) ----
  const pass = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(pass, {
      toValue: allPass ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // animates borderColor / shadowColor
    }).start();
  }, [allPass, pass]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  // ---- request permission on mount ----
  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  // ---- drive the auto-capture state machine while the camera is live ----
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'tick', dtMs: TICK_MS, allPass }), TICK_MS);
    return () => clearInterval(id);
  }, [allPass]);

  // ---- fire the photo exactly once when the machine reaches 'captured' ----
  const firedRef = useRef(false);
  const takePhoto = useCallback(async () => {
    try {
      const photo = await photoOutput.capturePhoto({}, {});
      // writeUprightStill owns the Photo from here — it disposes it on every path.
      const { uri, meta } = await writeUprightStill(photo);
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]).start();
      onCaptured(uri, meta);
    } catch {
      firedRef.current = false; // allow a retry on a failed capture
      dispatch({ type: 'reset' });
    }
  }, [photoOutput, flash, onCaptured]);

  useEffect(() => {
    if (state.phase === 'captured' && !firedRef.current) {
      firedRef.current = true;
      void takePhoto();
    }
  }, [state.phase, takePhoto]);

  // Dev-only manual shutter — same one-shot guard as the automatic path, no countdown, no gate.
  const manualCapture = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    void takePhoto();
  }, [takePhoto]);

  // ---- permission / device fallbacks ----
  if (!hasPermission) {
    return (
      <Screen className="px-6">
        <View className="flex-1 items-center justify-center">
          <GlassCard className="w-full items-center gap-4 px-7 py-8" radius={32}>
            <Display className="text-center text-[26px]">Camera access needed</Display>
            <Body className="text-center text-ink-soft">
              TrueTone uses the front camera only to analyze how your skin looks, on your device. Your
              photo never leaves your device and is deleted right after the analysis.
            </Body>
            <View className="w-full gap-3 mt-1">
              <PrimaryButton label="Open Settings" fullWidth onPress={() => void Linking.openSettings()} />
              <PrimaryButton label="Go back" variant="ghost" fullWidth onPress={onCancel} />
            </View>
          </GlassCard>
        </View>
      </Screen>
    );
  }

  if (!device) {
    return (
      <Screen className="px-6">
        <View className="flex-1 items-center justify-center">
          <GlassCard className="w-full items-center gap-4 px-7 py-8" radius={32}>
            <Display className="text-center text-[26px]">No front camera found</Display>
            <Body className="text-center text-ink-soft">This device doesn’t expose a front camera to TrueTone.</Body>
            <View className="w-full mt-1">
              <PrimaryButton label="Go back" variant="ghost" fullWidth onPress={onCancel} />
            </View>
          </GlassCard>
        </View>
      </Screen>
    );
  }

  const ovalBorder = pass.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.78)', PASS] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const breatheOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });
  const counting = state.phase === 'countdown';

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        // Exactly TWO outputs besides Preview. Each output is a CameraX use case, and CameraX only
        // guarantees Preview + ImageCapture + ONE ImageAnalysis — a second concurrent ImageAnalysis
        // threw "No supported surface combination" on the Fold 7. Face detection therefore runs
        // inside lumaOutput's worklet rather than owning an output (see use-frame-metrics.ts).
        // Do not add a third output here without re-testing on hardware.
        outputs={[photoOutput, lumaOutput].filter(
          (o): o is NonNullable<typeof o> => o != null,
        )}
      />

      {/* top scrim + guidance hint */}
      <View style={[styles.topScrim, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.wordmark}>Hold steady</Text>
        <View style={[styles.hintPill, allPass && styles.hintPillPass]}>
          <Text style={[styles.hintText, allPass && styles.hintTextPass]}>{quality.hint}</Text>
        </View>
      </View>

      {/* center oval guide */}
      <View style={styles.centerArea} pointerEvents="none">
        {!allPass && (
          <Animated.View
            style={[
              styles.ovalGlow,
              { width: glow.width, height: glow.height, borderRadius: glow.height / 2 },
              { transform: [{ scale: breatheScale }], opacity: breatheOpacity },
            ]}
          />
        )}
        <Animated.View
          style={[
            styles.oval,
            { width: oval.width, height: oval.height, borderRadius: oval.height / 2 },
            { borderColor: ovalBorder, shadowColor: ovalBorder },
          ]}
        >
          {counting && <Text style={styles.countdown}>{countdownSeconds(state)}</Text>}
        </Animated.View>
      </View>

      {/* per-check status strip */}
      <View
        style={[styles.checkStrip, { bottom: insets.bottom + (isShort ? 84 : 116) }]}
        pointerEvents="none"
      >
        <CheckChip label="Face" ok={quality.face} />
        <CheckChip label="Light" ok={quality.lighting} />
        <CheckChip label="Framing" ok={quality.distance} />
        <CheckChip label="Focus" ok={quality.focus} />
      </View>

      {/* bottom: privacy reassurance + cancel */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.lightHint}>Natural light works best</Text>
        {__DEV__ && devForceCapture ? (
          <Pressable
            style={[styles.shutter, styles.shutterArmed]}
            onPress={manualCapture}
            accessibilityRole="button"
            accessibilityLabel="Capture now, ignoring the quality gate (dev)"
          >
            <View style={[styles.shutterInner, styles.shutterInnerArmed]} />
          </Pressable>
        ) : (
          <View style={styles.shutter}><View style={styles.shutterInner} /></View>
        )}
        {__DEV__ && devForceCapture && (
          <Text style={styles.forceHint}>DEV: tap the shutter to capture regardless of the gate</Text>
        )}
        <Text style={styles.privacy}>{PRIVACY_LINE}</Text>
        <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={counting}>
          <Text style={[styles.cancelText, counting && styles.cancelTextDim]}>Cancel</Text>
        </Pressable>
      </View>

      {/* capture flash */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} pointerEvents="none" />

      {/* dev-only calibration overlay */}
      {__DEV__ && <MetricsDebug metrics={metrics} quality={quality} insetTop={insets.top} />}
    </View>
  );
}

function CheckChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={[styles.chip, ok && styles.chipOk]}>
      <View style={[styles.chipDot, ok && styles.chipDotOk]} />
      <Text style={[styles.chipText, ok && styles.chipTextOk]}>{label}</Text>
    </View>
  );
}

// Dev-only overlay: raw metric values + the gate thresholds, to calibrate on a physical device
// (THRESHOLDS + luma SHARPNESS_SCALE). Rendered only under __DEV__; not part of the shipped UI.
function DebugRow({ label, value, range, ok }: { label: string; value: string; range: string; ok: boolean }) {
  return (
    <Text style={[styles.dbgRow, { color: ok ? PASS_GREEN : '#fca5a5' }]}>
      {ok ? '✓' : '✗'} {label} {value} <Text style={styles.dbgRange}>{range}</Text>
    </Text>
  );
}

function MetricsDebug({
  metrics,
  quality,
  insetTop,
}: {
  metrics: FrameMetrics;
  quality: QualityReport;
  insetTop: number;
}) {
  const f = (n: number) => n.toFixed(2);
  return (
    <View style={[styles.dbgPanel, { top: insetTop + 56 }]} pointerEvents="none">
      <Text style={styles.dbgTitle}>metrics (dev)</Text>
      <DebugRow label="face" value={metrics.faceDetected ? 'yes' : 'no'} range={`cen ${f(metrics.faceCenteredness)}≥${THRESHOLDS.centeredness}`} ok={quality.face} />
      <DebugRow label="light" value={f(metrics.brightness)} range={`${THRESHOLDS.brightnessMin}–${THRESHOLDS.brightnessMax}`} ok={quality.lighting} />
      <DebugRow label="frame" value={f(metrics.faceFraction)} range={`${THRESHOLDS.faceFractionMin}–${THRESHOLDS.faceFractionMax}`} ok={quality.distance} />
      <DebugRow label="focus" value={f(metrics.sharpness)} range={`≥${THRESHOLDS.sharpness}`} ok={quality.focus} />
      <DebugRow label="clip" value={f(metrics.clipping)} range={`≤${THRESHOLDS.clippingMax}`} ok={quality.glare} />
      <DebugRow label="cct" value={`${Math.round(metrics.cct)}K`} range={`${THRESHOLDS.cctMin}–${THRESHOLDS.cctMax}K`} ok={quality.colour} />
      <DebugRow label="even" value={f(metrics.imbalance)} range={`≤${THRESHOLDS.imbalanceMax}`} ok={quality.evenness} />
      <DebugRow
        label="pose"
        value={`yaw ${f(metrics.yaw)}° roll ${f(metrics.roll)}°`}
        range={`±${THRESHOLDS.poseMax}°`}
        ok={quality.pose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.camera },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 18,
    backgroundColor: 'rgba(31,26,20,0.34)', // warm ink scrim, not a cold black
  },
  wordmark: { color: 'rgba(255,255,255,0.95)', fontFamily: fonts.displayMedium, fontSize: 19, letterSpacing: 0.3, marginBottom: 12 },
  hintPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  hintPillPass: { backgroundColor: 'rgba(47,125,82,0.26)', borderColor: 'rgba(47,125,82,0.5)' },
  hintText: { color: 'rgba(255,255,255,0.92)', fontFamily: fonts.bodyMedium, fontSize: 15 },
  hintTextPass: { color: palette.white },
  centerArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ovalGlow: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)', // soft warm-white guide ring, not a clinical dashed line
  },
  oval: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.85,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  countdown: { color: palette.white, fontFamily: fonts.displayLight, fontSize: 96, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 12 },
  checkStrip: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(31,26,20,0.5)', // warm frosted chip
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipOk: { backgroundColor: 'rgba(47,125,82,0.24)', borderColor: 'rgba(47,125,82,0.45)' },
  chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  chipDotOk: { backgroundColor: PASS },
  chipText: { color: 'rgba(255,255,255,0.72)', fontFamily: fonts.bodySemibold, fontSize: 13 },
  chipTextOk: { color: palette.white },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  lightHint: { color: 'rgba(255,255,255,0.66)', fontFamily: fonts.bodyMedium, fontSize: 14, marginBottom: 2 },
  shutter: { width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.22)' },
  // dev-only manual shutter — visibly different so a tappable shutter is never mistaken for the
  // shipped decorative one
  shutterArmed: { borderColor: '#d946ef' },
  shutterInnerArmed: { backgroundColor: 'rgba(217,70,239,0.55)' },
  forceHint: { color: '#f0abfc', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  privacy: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  cancelBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelText: { color: palette.white, fontFamily: fonts.bodySemibold, fontSize: 15 },
  cancelTextDim: { color: 'rgba(255,255,255,0.35)' },
  flash: { backgroundColor: palette.white },
  // dev-only calibration overlay
  dbgPanel: {
    position: 'absolute',
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 2,
  },
  dbgTitle: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  dbgRow: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '600' },
  dbgRange: { color: 'rgba(255,255,255,0.45)', fontWeight: '400' },
});
