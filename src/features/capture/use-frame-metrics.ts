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
import { computeChromaStats } from './chroma-metrics';

type FaceMetrics = Pick<FrameMetrics, 'faceDetected' | 'faceCenteredness' | 'faceFraction' | 'yaw' | 'roll'>;
type LumaMetrics = Pick<FrameMetrics, 'brightness' | 'sharpness'>;
type ChromaMetrics = Pick<FrameMetrics, 'clipping' | 'cct' | 'imbalance'>;

const BLANK_FACE: FaceMetrics = {
  faceDetected: false, faceCenteredness: 0, faceFraction: 0, yaw: 0, roll: 0,
};
const NEUTRAL_LUMA: LumaMetrics = { brightness: ASSUMED_BRIGHTNESS, sharpness: ASSUMED_SHARPNESS };
const NEUTRAL_CHROMA: ChromaMetrics = { clipping: 0, cct: 6500, imbalance: 0 };

// Luma downsample grid — small enough to pass to the JS thread cheaply each processed frame.
const LUMA_COLS = 32;
const LUMA_ROWS = 44;

// Coarse RGB downsample grid for chroma stats (glare/colour-cast/side-light) — deliberately much
// smaller than the luma grid since chroma only needs coarse, global statistics.
const CHROMA_COLS = 12;
const CHROMA_ROWS = 16;

// Scripted simulation story: searching → aligned-but-too-far → well-framed. [untilElapsedMs, metrics].
const SIM_TIMELINE: ReadonlyArray<readonly [number, FrameMetrics]> = [
  [1200, { faceDetected: false, faceCenteredness: 0, brightness: 0, sharpness: 0, faceFraction: 0, yaw: 0, roll: 0, clipping: 0, cct: 6500, imbalance: 0 }],
  [2400, { faceDetected: true, faceCenteredness: 0.82, brightness: 0.58, sharpness: 0.72, faceFraction: 0.15, yaw: 0, roll: 0, clipping: 0.01, cct: 5200, imbalance: 0.05 }],
  [Infinity, { faceDetected: true, faceCenteredness: 0.88, brightness: 0.6, sharpness: 0.74, faceFraction: 0.42, yaw: 0, roll: 0, clipping: 0.01, cct: 5200, imbalance: 0.05 }],
];

function metricsForElapsed(ms: number): FrameMetrics {
  for (const [until, m] of SIM_TIMELINE) {
    if (ms < until) return m;
  }
  return SIM_TIMELINE[SIM_TIMELINE.length - 1][1];
}

// Real frame processors (face detector + luma) need native modules, so they only exist in a DEV
// BUILD — never in Expo Go. All of them are already declared in package.json and ship with
// vision-camera v5: `useFrameOutput` is exported by react-native-vision-camera itself, backed by
// react-native-nitro-modules + react-native-nitro-image + react-native-worklets.
//
// (An earlier note here named `react-native-vision-camera-worklets` as a missing prerequisite. That
// package belongs to the v3/v4 worklets-core model and does not apply to v5 — nothing is missing.)
//
// When true the gate runs on the REAL camera signals; when false it falls back to SIM_TIMELINE, a
// scripted sequence that auto-advances to "well framed" regardless of what the camera sees. Sim mode
// is for rendering the capture screen without native modules — it must never drive a real read.
const FRAME_PROCESSORS_INSTALLED = true;

export interface UseFrameMetricsOptions {
  /** Drive metrics from the scripted simulation instead of the real on-device signals. */
  simulate?: boolean;
}

export function useFrameMetrics({ simulate = !FRAME_PROCESSORS_INSTALLED }: UseFrameMetricsOptions = {}) {
  const { width, height } = useWindowDimensions();
  const [metrics, setMetrics] = useState<FrameMetrics>({ ...BLANK_FACE, ...NEUTRAL_LUMA, ...NEUTRAL_CHROMA });

  const faceRef = useRef<FaceMetrics>(BLANK_FACE);
  const lumaRef = useRef<LumaMetrics>(NEUTRAL_LUMA);
  const chromaRef = useRef<ChromaMetrics>(NEUTRAL_CHROMA);

  const publish = useCallback(() => {
    if (!simulate) setMetrics({ ...faceRef.current, ...lumaRef.current, ...chromaRef.current });
  }, [simulate]);

  // FACE + LUMA come from real frame processors, which are native and exist only in a dev build.
  // Gate the hook calls on a module CONSTANT so React's hook order stays stable across renders
  // despite the conditional call (the lint rule is safe to suppress here for that reason).
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
          faceRef.current = {
            faceDetected: m.faceDetected,
            faceCenteredness: m.faceCenteredness,
            faceFraction: m.faceFraction,
            yaw: m.yaw,
            roll: m.roll,
          };
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

  // GLARE + COLOUR CAST + SIDE LIGHT signal ----------------------------------
  const onChromaGrid = useCallback(
    (rgbGrid: number[], cols: number, rows: number) => {
      chromaRef.current = computeChromaStats(rgbGrid, cols, rows);
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
        const planes = frame.getPlanes();
        const plane = planes[0]; // Y (luma)
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

        // Coarse RGB grid for chroma stats (glare / colour cast / side light). DEVICE-ONLY: whether
        // U/V arrive as separate planar planes or one interleaved semi-planar plane (and their
        // subsampling) varies by device/codec — this best-effort YUV->RGB conversion, like the luma
        // plane layout above, needs on-device confirmation.
        if (planes.length >= 2) {
          const uPlane = planes[1];
          const vPlane = planes.length >= 3 ? planes[2] : planes[1];
          const uBuf = new Uint8Array(uPlane.getPixelBuffer());
          const vBuf = new Uint8Array(vPlane.getPixelBuffer());
          const uStride = uPlane.bytesPerRow;
          const vStride = vPlane.bytesPerRow;
          const interleaved = planes.length === 2;
          const chromaPixelStride = interleaved ? 2 : 1;
          const vByteOffset = interleaved ? 1 : 0;
          const chromaW = uPlane.width;
          const chromaH = uPlane.height;
          const cStepX = Math.max(1, Math.floor(chromaW / CHROMA_COLS));
          const cStepY = Math.max(1, Math.floor(chromaH / CHROMA_ROWS));
          const rgbGrid: number[] = [];
          let cCols = 0;
          let cRows = 0;
          for (let r = 0; r < chromaH; r += cStepY) {
            cRows += 1;
            cCols = 0;
            for (let c = 0; c < chromaW; c += cStepX) {
              // U/V planes are typically half-resolution (4:2:0) — sample luma at 2x the chroma
              // coordinate to align them.
              const yy = y[Math.min(h - 1, r * 2) * stride + Math.min(w - 1, c * 2)];
              const uu = uBuf[r * uStride + c * chromaPixelStride] - 128;
              const vv = vBuf[r * vStride + c * chromaPixelStride + vByteOffset] - 128;
              const rr = yy + 1.402 * vv;
              const gg = yy - 0.344136 * uu - 0.714136 * vv;
              const bb = yy + 1.772 * uu;
              rgbGrid.push(
                Math.max(0, Math.min(255, rr)),
                Math.max(0, Math.min(255, gg)),
                Math.max(0, Math.min(255, bb)),
              );
              cCols += 1;
            }
          }
          runOnJS(onChromaGrid)(rgbGrid, cCols, cRows);
        }
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
