import { Platform } from 'react-native';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

let cached: boolean | undefined;

/**
 * True when the device can render Apple's native Liquid Glass (iOS 26+ with the runtime API
 * present). Everything else — iOS < 26, Android, web, or a dev build compiled before
 * expo-glass-effect was added — gets the Quiet Glass blur fallback. Never throws.
 */
export function hasLiquidGlass(): boolean {
  if (cached === undefined) cached = detectLiquidGlass(Platform.OS);
  return cached;
}

/** Pure detection for a given platform (exported for tests; `Platform.OS` is inlined at build). */
export function detectLiquidGlass(os: string): boolean {
  if (os !== 'ios') return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    // Native module missing from this binary: fall back rather than crash the shell.
    return false;
  }
}

/** Clearance for the custom floating GlassTabBar (bar + breathing room + typical inset). */
const FLOATING_BAR_CLEARANCE = 108;
/** Clearance for the native UITabBar: 49pt bar + breathing room above the safe-area inset. */
const NATIVE_BAR_CLEARANCE = 64;

/**
 * Bottom space (on top of the safe-area inset) a scrollable tab screen reserves so its last
 * content clears whichever tab bar this device renders. Single source of truth.
 */
export function tabBarClearance(): number {
  return hasLiquidGlass() ? NATIVE_BAR_CLEARANCE : FLOATING_BAR_CLEARANCE;
}
