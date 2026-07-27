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
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Camera access needed</Text>
        <Text style={styles.fallbackBody}>
          TrueTone uses the front camera only to analyze how your skin looks, on your device. Your
          photo never leaves your device and is deleted right after the analysis.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => void Linking.openSettings()}>
          <Text style={styles.primaryBtnText}>Open Settings</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={onCancel}>
          <Text style={styles.ghostBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>No front camera found</Text>
        <Text style={styles.fallbackBody}>This device doesn’t expose a front camera to TrueTone.</Text>
        <Pressable style={styles.ghostBtn} onPress={onCancel}>
          <Text style={styles.ghostBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const ovalBorder = pass.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.78)', PASS_GREEN] });
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111111' },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 18,
    backgroundColor: 'rgba(17,17,17,0.24)',
  },
  wordmark: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 10 },
  hintPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  hintPillPass: { backgroundColor: 'rgba(52,211,153,0.22)' },
  hintText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  hintTextPass: { color: '#bbf7d0' },
  centerArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ovalGlow: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(126,145,116,0.72)',
  },
  oval: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  countdown: { color: '#fff', fontSize: 96, fontWeight: '200', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 12 },
  checkStrip: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  chipOk: { backgroundColor: 'rgba(52,211,153,0.2)' },
  chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  chipDotOk: { backgroundColor: PASS_GREEN },
  chipText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  chipTextOk: { color: '#bbf7d0' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  lightHint: { color: 'rgba(255,255,255,0.62)', fontSize: 14, marginBottom: 2 },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)' },
  // dev-only manual shutter — visibly different so a tappable shutter is never mistaken for the
  // shipped decorative one
  shutterArmed: { borderColor: '#d946ef' },
  shutterInnerArmed: { backgroundColor: 'rgba(217,70,239,0.55)' },
  forceHint: { color: '#f0abfc', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  privacy: { color: 'rgba(255,255,255,0.62)', fontSize: 12, textAlign: 'center' },
  cancelBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  cancelText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelTextDim: { color: 'rgba(255,255,255,0.35)' },
  flash: { backgroundColor: '#fff' },
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
  // permission / no-device fallbacks
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, backgroundColor: '#0b0b0c' },
  fallbackTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  fallbackBody: { color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  primaryBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, backgroundColor: '#7c3aed' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  ghostBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
});
