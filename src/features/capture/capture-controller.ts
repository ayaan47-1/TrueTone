// src/features/capture/capture-controller.ts
// Pure reducer for hands-free auto-capture. The UI feeds ticks with the current
// quality-gate allPass; this advances idle -> holding -> countdown -> captured.
export type CapturePhase = 'idle' | 'holding' | 'countdown' | 'captured';
export type CaptureState = { phase: CapturePhase; holdMs: number; countdownMs: number };
export type CaptureEvent = { type: 'tick'; dtMs: number; allPass: boolean } | { type: 'reset' };

export const HOLD_REQUIRED_MS = 1500;
export const COUNTDOWN_MS = 3000;
export const initialCaptureState: CaptureState = { phase: 'idle', holdMs: 0, countdownMs: 0 };

export function captureReducer(s: CaptureState, e: CaptureEvent): CaptureState {
  if (e.type === 'reset') return initialCaptureState;
  if (s.phase === 'captured') return s;            // terminal
  if (!e.allPass) return initialCaptureState;      // lost alignment -> restart
  if (s.phase === 'idle') return { phase: 'holding', holdMs: 0, countdownMs: 0 };
  if (s.phase === 'holding') {
    const holdMs = s.holdMs + e.dtMs;
    return holdMs >= HOLD_REQUIRED_MS
      ? { phase: 'countdown', holdMs, countdownMs: 0 }
      : { ...s, holdMs };
  }
  const countdownMs = s.countdownMs + e.dtMs;       // countdown
  return countdownMs >= COUNTDOWN_MS
    ? { phase: 'captured', holdMs: s.holdMs, countdownMs }
    : { ...s, countdownMs };
}

export function countdownSeconds(s: CaptureState): number {
  if (s.phase !== 'countdown') return 0;
  return Math.max(1, Math.ceil((COUNTDOWN_MS - s.countdownMs) / 1000));
}
