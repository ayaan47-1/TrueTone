// src/features/capture/use-frame-metrics.ts
//
// Quality metrics that drive the guided-capture gate (see ./quality-gate).
//
// DEVICE-ONLY (real path): on a physical device the live metrics come from a vision-camera v5
// frame output (`useFrameOutput`, confirmed via Context7 2026-06-18) that computes brightness +
// sharpness from the luma plane, plus a face-detector plugin (NitroModules) for face bbox /
// centeredness. That plugin is a native dependency that must be confirmed + installed on-device
// (plan Task 4.3, Step 1), so it is intentionally NOT wired here yet.
//
// Until it lands, a short scripted simulation drives a realistic metrics sequence so the whole
// guided-capture experience — blocking quality gate → 3-2-1 auto-capture — is fully demonstrable
// and looks right in the dev build. Flip `simulate` to false the moment the real frame processor
// is wired; the on-device worklet then pushes metrics via `setMetrics` (runOnJS).
import { useEffect, useRef, useState } from 'react';
import type { FrameMetrics } from './quality-gate';

const BLANK: FrameMetrics = {
  faceDetected: false,
  faceCenteredness: 0,
  brightness: 0,
  sharpness: 0,
  faceFraction: 0,
};

// A short, deterministic story: searching → aligned-but-too-far → well-framed. Each entry is
// [untilElapsedMs, metrics]; the last entry holds so auto-capture can complete.
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
  /** When true, drive metrics from the scripted simulation instead of the (device-only) frame processor. */
  simulate?: boolean;
}

export function useFrameMetrics({ simulate = __DEV__ }: UseFrameMetricsOptions = {}) {
  const [metrics, setMetrics] = useState<FrameMetrics>(BLANK);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!simulate) return; // real path: the device frame output pushes metrics via setMetrics.
    startRef.current = Date.now();
    setMetrics(BLANK);
    const id = setInterval(() => {
      const elapsed = Date.now() - (startRef.current ?? Date.now());
      setMetrics(metricsForElapsed(elapsed));
    }, 100);
    return () => clearInterval(id);
  }, [simulate]);

  // `setMetrics` is exposed so the on-device frame processor can push real metrics (runOnJS).
  return { metrics, setMetrics };
}
