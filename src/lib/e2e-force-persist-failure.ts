// src/lib/e2e-force-persist-failure.ts
//
// E2E-only test seam (HAG-231, Toby review finding 1). run-read.ts's shade is published to
// `personalization` BEFORE persistence runs, so a Maestro flow that only asserts the result
// screen can pass even when the save afterwards fails. Flipping this flag makes the real
// persistence step fail deterministically, so a flow that also revisits scan history (the one
// place that reads the save back) can prove its assertion actually catches a broken save and
// is not vacuous. Gated exactly like src/lib/e2e-fixture.ts: __DEV__ is checked FIRST with `&&`
// short-circuiting, so it is structurally unreachable in release/TestFlight/App Store/EAS
// preview/production builds regardless of the env var's value.
//
// This does not change what the app does when persistence fails -- it only lets a test force
// that case. The underlying premature-success behavior (shade shown before the save is known to
// have succeeded) is a real app finding, reported separately, not fixed in this branch.
export const E2E_FORCE_PERSIST_FAILURE =
  __DEV__ && /^(1|true|yes|on)$/i.test((process.env.EXPO_PUBLIC_E2E_FORCE_PERSIST_FAILURE ?? '').trim());
