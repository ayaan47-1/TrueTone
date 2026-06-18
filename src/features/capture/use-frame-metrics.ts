// src/features/capture/use-frame-metrics.ts
//
// Quality metrics that drive the guided-capture gate (see ./quality-gate).
//
// REAL PATH (default): face presence / centering / distance come from a real on-device face
// detector — `react-native-vision-camera-face-detector` v2 (vision-camera v5 + NitroModules). The
// detector runs entirely on-device; the image never leaves the phone (CLAUDE.md §3). Its
// `useFaceDetectorOutput` hook returns a CameraOutput whose `onFacesDetected` callback we map to
// FrameMetrics via the pure, unit-tested `facesToMetrics`. Brightness/sharpness are neutral-pass
// for now (the detector doesn't measure them) — a luma frame processor for real light/focus
// metering is the follow-up. The 0.2–0.6 framing + 0.6 centeredness thresholds are calibrated for
// the simulation and SHOULD be re-tuned on a physical device.
//
// SIMULATION (simulate: true): a scripted metrics sequence (searching → too far → aligned) so the
// full gate → countdown → capture flow is demonstrable without a face in view. Default off now
// that real detection is wired.
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useFaceDetectorOutput, type Face } from 'react-native-vision-camera-face-detector';
import type { FrameMetrics } from './quality-gate';
import { facesToMetrics } from './face-metrics';

const BLANK: FrameMetrics = {
  faceDetected: false,
  faceCenteredness: 0,
  brightness: 0,
  sharpness: 0,
  faceFraction: 0,
};

// Scripted simulation story: searching → aligned-but-too-far → well-framed. [untilElapsedMs, metrics].
const SIM_TIMELINE: ReadonlyArray<readonly [number, FrameMetrics]> = [
  [1200, BLANK],
  [2400, { faceDetected: true, faceCenteredness: 0.82, brightness: 0.58, sharpness: 0.72, faceFraction: 0.15 }],
  [Infinity, { faceDetected: true, faceCenteredness: 0.88, brightness: 0.6, sharpness: 0.74, faceFraction: 0.42 }],
];

function metricsForElapsed(ms: number): FrameMetrics {
  for (const [until, m] of SIM_TIMELINE) {
    if (ms < until) return m;
  }
  return SIM_TIMELINE[SIM_TIMELINE.length - 1][1];
}

export interface UseFrameMetricsOptions {
  /** Drive metrics from the scripted simulation instead of the real on-device face detector. */
  simulate?: boolean;
}

export function useFrameMetrics({ simulate = false }: UseFrameMetricsOptions = {}) {
  const { width, height } = useWindowDimensions();
  const [metrics, setMetrics] = useState<FrameMetrics>(BLANK);

  // Real detector output — attach to the Camera's `outputs`. autoMode + screen dims give bounds in
  // screen coordinates, which facesToMetrics expects.
  const faceOutput = useFaceDetectorOutput({
    cameraFacing: 'front',
    performanceMode: 'fast',
    autoMode: true,
    windowWidth: width,
    windowHeight: height,
    outputResolution: 'preview',
    onFacesDetected: (faces: Face[]) => {
      if (!simulate) setMetrics(facesToMetrics(faces, width, height));
    },
    onError: () => {
      if (!simulate) setMetrics(BLANK);
    },
  });

  useEffect(() => {
    if (!simulate) return;
    const start = Date.now();
    setMetrics(BLANK);
    const id = setInterval(() => setMetrics(metricsForElapsed(Date.now() - start)), 100);
    return () => clearInterval(id);
  }, [simulate]);

  return { metrics, setMetrics, faceOutput };
}
