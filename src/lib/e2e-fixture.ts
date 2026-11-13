// src/lib/e2e-fixture.ts
//
// E2E-only capture-step substitution gate (HAG-231). `global.__DEV__` is checked FIRST and with
// `&&` short-circuiting, so the env var's value is never even inspected in a non-dev build - this
// is what makes the flag structurally unreachable in release/TestFlight/App Store/EAS
// preview/production builds, not just "off by default" there. See
// src/features/consent/__tests__/ (DEMO_MODE/CAMERA_DEMO) for the same truthy-string convention
// this reuses.
//
// This gate replaces ONLY the capture step (app/scan/index.tsx calls onCaptured with a bundled
// synthetic fixture image instead of mounting <Capture>) - everything downstream (the on-device
// read, shade derivation, persistence, image-cleanup, no-egress) runs completely unchanged. It
// does not revive runStubRead() or skip the read/match pipeline.
export const E2E_FIXTURE_SCAN =
  __DEV__ && /^(1|true|yes|on)$/i.test((process.env.EXPO_PUBLIC_E2E_FIXTURE_SCAN ?? '').trim());
