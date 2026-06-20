// src/features/capture/use-frame-metrics.ts
//
// Quality metrics that drive the guided-capture gate (see ./quality-gate). Two real, on-device
// signals are merged — the image never leaves the phone (CLAUDE.md §3):
//
//   • FACE (presence / centering / distance) — react-native-vision-camera-face-detector v2
//     (vision-camera v5 + NitroModules) via `useFaceDetectorOutput`. Bounds → FrameMetrics by the
//     pure, unit-tested `facesToMetrics` (autoMode + screen dims → screen-space bounds).
//   • LIGHT + FOCUS (brightness / sharpness) — a `useFrameOutput` worklet samples the Y (luma)
//     plane down to a small grid and hands it to the pure, unit-tested `computeLumaStats` on the JS
//     thread. Global stats, so orientation-invariant.
//
// Each source updates its own ref; `publish` merges them into one FrameMetrics. The luma ref starts
// at neutral-pass values so the gate degrades gracefully (face-only) if the frame processor never
// fires on a given device. DEVICE-ONLY plane layout (bytesPerRow / planar YUV) is best-effort and
// must be confirmed on a physical device; thresholds + SHARPNESS_SCALE should be re-tuned there.
//
// SIMULATION (simulate: true): a scripted metrics sequence so the full gate → countdown → capture
// flow is demonstrable without a real face/scene. Default off now that both real signals are wired.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { useFaceDetectorOutput, type Face } from 'react-native-vision-camera-face-detector';
import { runOnJS } from 'react-native-worklets';
import type { FrameMetrics } from './quality-gate';
import { facesToMetrics, ASSUMED_BRIGHTNESS, ASSUMED_SHARPNESS } from './face-metrics';
import { computeLumaStats } from './luma-metrics';

type FaceMetrics = Pick<FrameMetrics, 'faceDetected' | 'faceCenteredness' | 'faceFraction'>;
type LumaMetrics = Pick<FrameMetrics, 'brightness' | 'sharpness'>;

const BLANK_FACE: FaceMetrics = { faceDetected: false, faceCenteredness: 0, faceFraction: 0 };
const NEUTRAL_LUMA: LumaMetrics = { brightness: ASSUMED_BRIGHTNESS, sharpness: ASSUMED_SHARPNESS };

// Luma downsample grid — small enough to pass to the JS thread cheaply each processed frame.
const LUMA_COLS = 32;
const LUMA_ROWS = 44;

// Scripted simulation story: searching → aligned-but-too-far → well-framed. [untilElapsedMs, metrics].
const SIM_TIMELINE: ReadonlyArray<readonly [number, FrameMetrics]> = [
  [1200, { faceDetected: false, faceCenteredness: 0, brightness: 0, sharpness: 0, faceFraction: 0 }],
  [2400, { faceDetected: true, faceCenteredness: 0.82, brightness: 0.58, sharpness: 0.72, faceFraction: 0.15 }],
  [Infinity, { faceDetected: true, faceCenteredness: 0.88, brightness: 0.6, sharpness: 0.74, faceFraction: 0.42 }],
];

function metricsForElapsed(ms: number): FrameMetrics {
  for (const [until, m] of SIM_TIMELINE) {
    if (ms < until) return m;
  }
  return SIM_TIMELINE[SIM_TIMELINE.length - 1][1];
}

// Real frame processors (face detector + luma) require react-native-vision-camera-worklets, which
// is a NATIVE module — installing it needs a rebuild. Flip this to true only in a dev build that
// has it. Until then the frame-processor hooks are skipped and the gate runs on the scripted
// simulation, so the camera screen renders without that native dependency.
const FRAME_PROCESSORS_INSTALLED = false;

export interface UseFrameMetricsOptions {
  /** Drive metrics from the scripted simulation instead of the real on-device signals. */
  simulate?: boolean;
}

export function useFrameMetrics({ simulate = !FRAME_PROCESSORS_INSTALLED }: UseFrameMetricsOptions = {}) {
  const { width, height } = useWindowDimensions();
  const [metrics, setMetrics] = useState<FrameMetrics>({ ...BLANK_FACE, ...NEUTRAL_LUMA });

  const faceRef = useRef<FaceMetrics>(BLANK_FACE);
  const lumaRef = useRef<LumaMetrics>(NEUTRAL_LUMA);

  const publish = useCallback(() => {
    if (!simulate) setMetrics({ ...faceRef.current, ...lumaRef.current });
  }, [simulate]);

  // FACE + LUMA come from real frame processors, which need react-native-vision-camera-worklets
  // (native). Gate the hook calls on a module CONSTANT so React's hook order stays stable across
  // renders despite the conditional call (the lint rule is safe to suppress here for that reason).
  /* eslint-disable react-hooks/rules-of-hooks */
  // FACE signal -------------------------------------------------------------
  const faceOutput = FRAME_PROCESSORS_INSTALLED
    ? useFaceDetectorOutput({
        cameraFacing: 'front',
        performanceMode: 'fast',
        autoMode: true,
        windowWidth: width,
        windowHeight: height,
        outputResolution: 'preview',
        onFacesDetected: (faces: Face[]) => {
          const m = facesToMetrics(faces, width, height);
          faceRef.current = { faceDetected: m.faceDetected, faceCenteredness: m.faceCenteredness, faceFraction: m.faceFraction };
          publish();
        },
        onError: () => {
          faceRef.current = BLANK_FACE;
          publish();
        },
      })
    : undefined;

  // LIGHT + FOCUS signal ----------------------------------------------------
  const onLumaGrid = useCallback(
    (grid: number[], cols: number, rows: number) => {
      lumaRef.current = computeLumaStats(grid, cols, rows);
      publish();
    },
    [publish],
  );

  const lumaOutput = !FRAME_PROCESSORS_INSTALLED
    ? undefined
    : useFrameOutput({
    pixelFormat: 'yuv',
    onFrame: (frame: Frame) => {
      'worklet';
      try {
        if (!frame.isPlanar) return;
        const plane = frame.getPlanes()[0]; // Y (luma)
        const y = new Uint8Array(plane.getPixelBuffer()); // view — no copy
        const w = plane.width;
        const h = plane.height;
        const stride = plane.bytesPerRow;
        const stepX = Math.max(1, Math.floor(w / LUMA_COLS));
        const stepY = Math.max(1, Math.floor(h / LUMA_ROWS));
        const grid: number[] = [];
        let cols = 0;
        let rows = 0;
        for (let r = 0; r < h; r += stepY) {
          rows += 1;
          cols = 0;
          for (let c = 0; c < w; c += stepX) {
            grid.push(y[r * stride + c]);
            cols += 1;
          }
        }
        runOnJS(onLumaGrid)(grid, cols, rows);
      } catch {
        // DEVICE-ONLY: plane layout varies by device; skip a frame we can't read.
      } finally {
        frame.dispose();
      }
    },
  });
  /* eslint-enable react-hooks/rules-of-hooks */

  // SIMULATION --------------------------------------------------------------
  useEffect(() => {
    if (!simulate) return;
    const start = Date.now();
    setMetrics(metricsForElapsed(0));
    const id = setInterval(() => setMetrics(metricsForElapsed(Date.now() - start)), 100);
    return () => clearInterval(id);
  }, [simulate]);

  return { metrics, setMetrics, faceOutput, lumaOutput };
}
