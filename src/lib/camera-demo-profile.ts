// src/lib/camera-demo-profile.ts
// Local (non-Supabase) gate state for CAMERA_DEMO mode (tt-cam-pipeline B). The real
// /age-gate and /consent screens still run for real under this mode -- they must not depend
// on a live backend (the self-hosted backend is plain HTTP; iOS ATS blocks it in a standalone
// build) -- so under CAMERA_DEMO the same real taps flip THESE local flags instead of writing
// to Supabase. Both start false: is18/consentActive flip true ONLY when the corresponding
// screen's real onPass fires, never pre-resolved (Dwight's tt-cam-mode-ruling condition (b) --
// "If /scan is reachable without a real tap, the ruling is VOID"). Module-level state is fine
// here: one app process, one on-device session, same lifetime as personalization.ts's store.
let is18 = false;
let consentActive = false;

export function cameraDemoState(): { is18: boolean; consentActive: boolean } {
  return { is18, consentActive };
}

/** Called by AgeGate.tsx's real submit handler after a real 18+ pass under CAMERA_DEMO. */
export function cameraDemoSetIs18(): void {
  is18 = true;
}

/** Called by Consent.tsx's real consent handler after a real affirmative tap under CAMERA_DEMO. */
export function cameraDemoSetConsent(): void {
  consentActive = true;
}

export function cameraDemoReset(): void {
  is18 = false;
  consentActive = false;
}
