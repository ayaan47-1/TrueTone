import { useWindowDimensions } from 'react-native';

/**
 * Responsive layout helpers for the "Mist" system. The math lives in pure,
 * unit-tested functions so it can be reused by device-only screens (the camera
 * capture is excluded from Jest coverage) and verified without a layout pass.
 *
 * Motivation: the app is portrait-locked but must still *fill* unusual Android
 * aspect ratios — the narrow folded and near-square unfolded states of a
 * foldable — instead of relying on hardcoded pixel sizes that clip or float.
 */
export interface Size {
  width: number;
  height: number;
}

const SHEET_MAX = 440;
const CONTENT_MAX = 560;
const BASE_WIDTH = 390;
const OVAL_ASPECT = 350 / 268; // height / width of the capture guide oval
const OVAL_BASE_WIDTH = 268; // fallback guide width before the window is measured

/** Below this height the viewport is "short" (e.g. a folded cover screen) — tighten vertical rhythm. */
export const SHORT_VIEWPORT_THRESHOLD = 680;

/** Modal width: full-bleed-ish on narrow screens, capped so it isn't lost on wide ones. */
export function sheetMaxWidth(width: number): number {
  return Math.min(SHEET_MAX, width * 0.92);
}

/** Clamp a screen width to a comfortable reading column on large/unfolded screens. */
export function clampContentWidth(width: number): number {
  return Math.min(width, CONTENT_MAX);
}

/** A gentle scale factor vs. the design baseline, clamped so nothing balloons or collapses. */
export function uiScale(width: number): number {
  return Math.max(0.85, Math.min(1.15, width / BASE_WIDTH));
}

/** Camera guide-oval dimensions that fit the screen folded or unfolded. */
export function captureOvalSize({ width, height }: Size): Size {
  // Window not yet measured (height 0) → return a safe default at the design aspect
  // ratio rather than collapsing to {0,0} via the height-clamp branch.
  if (height <= 0) {
    return { width: OVAL_BASE_WIDTH, height: Math.round(OVAL_BASE_WIDTH * OVAL_ASPECT) };
  }
  let w = Math.min(Math.max(width * 0.72, 180), 320);
  let h = w * OVAL_ASPECT;
  const maxH = height * 0.52;
  if (h > maxH) {
    h = maxH;
    w = h / OVAL_ASPECT;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

/** Decorative bloom sizes, scaled to the largest screen dimension. */
export function bloomMetrics({ width, height }: Size): {
  rose: number;
  mauve: number;
  mist: number;
} {
  const max = Math.max(width, height);
  return {
    rose: Math.round(max * 0.43),
    mauve: Math.round(max * 0.36),
    mist: Math.round(max * 0.5),
  };
}

export interface ResponsiveLayout {
  width: number;
  height: number;
  contentWidth: number;
  scale: number;
  sheetMaxWidth: number;
  /** Short viewport (e.g. a folded cover screen) — tighten vertical rhythm. */
  isShort: boolean;
  /** Wide viewport (unfolded foldable / tablet) — center and cap content. */
  isWide: boolean;
}

/** Live responsive metrics; reacts to fold/unfold and rotation via `useWindowDimensions`. */
export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    contentWidth: clampContentWidth(width),
    scale: uiScale(width),
    sheetMaxWidth: sheetMaxWidth(width),
    isShort: height > 0 && height < SHORT_VIEWPORT_THRESHOLD,
    isWide: width >= 600,
  };
}
