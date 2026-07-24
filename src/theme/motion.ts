// Motion tokens — the single source for how TrueTone animates.
//
// The brief is "alive, not animated": short, low-travel, no bounce. Keeping the values here (rather
// than inline per screen) means the whole app can be re-timed in one place, and it documents the
// ceiling we hold ourselves to — nothing longer than `slow`, nothing further than `ENTER_OFFSET`.
//
// Motion is presentation only: it never changes copy, scores, or any claim the app makes.
import { Easing, useReducedMotion } from 'react-native-reanimated';

/** Animation lengths in ms. Nothing in the app should exceed `slow`. */
export const DURATION = { quick: 180, base: 240, slow: 320 } as const;

/** One calm ease-out curve, used for every timed animation. No overshoot. */
export const EASE = Easing.out(Easing.cubic);

/** Spring for press feedback — damped enough to settle without a visible bounce. */
export const SPRING = { damping: 18, stiffness: 180, mass: 0.9 } as const;

/** Gap between successive staggered entrances. */
export const STAGGER_MS = 50;

/** Cap on staggered items, so a long list doesn't trickle in. */
export const STAGGER_MAX = 6;

/** How far an entering element rises, in px. */
export const ENTER_OFFSET = 16;

/** Entrance delay for the item at `index`, clamped to [0, STAGGER_MAX] steps. */
export function staggerDelay(index: number): number {
  const step = Math.min(Math.max(index, 0), STAGGER_MAX);
  return step * STAGGER_MS;
}

/**
 * True when the OS asks for reduced motion — callers should render the final state directly
 * instead of animating to it.
 */
export function useCalm(): boolean {
  return useReducedMotion();
}
