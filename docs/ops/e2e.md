# On-device E2E tests (Maestro)

> **Scope:** automated on-device end-to-end tests for TrueTone's core flows, run before each
> release. Lives alongside (not instead of) `npm test` — these drive a real built app on a real
> iOS Simulator (and, once an Android emulator exists in your environment, an Android one too),
> covering things unit tests can't: actual navigation, actual permission prompts, actual
> build-time env wiring.
>
> Same compliance rules as everywhere (`CLAUDE.md`, `docs/ops/camera-on-testflight-compliance.md`):
> nothing here uploads a face image or writes to the live Supabase project. **One exception, by
> design and with explicit sign-off (HAG-231):** flows 3/4/5 hit the **live Shopify Storefront**
> (real product reads + a real cart create/update) and need network — see "Flows 3/4/5" below for
> the exact limits and why that's still safe. No flow ever places a real Shopify order.

## Prerequisites

- **Maestro CLI.** `curl -fsSL "https://get.maestro.mobile.dev" | bash`, then
  `export PATH="$PATH:$HOME/.maestro/bin"` (the installer adds this to `~/.zshrc`/`~/.bash_profile`
  too). Needs Java (`brew install openjdk` if missing).
- **Xcode + an iOS Simulator runtime.** `xcrun simctl list runtimes` must show at least one iOS
  runtime; if it doesn't, `xcodebuild -downloadPlatform iOS` fetches one (~7GB, several minutes).
- **Xcode/Swift version caveat (found authoring this, HAG-231).** A freshly-installed, very new
  Xcode/Swift toolchain can fail to compile `expo-modules-jsi` with a Swift "a C function pointer
  can only be formed from a reference to a func or a literal closure" error — a Swift-compiler-
  version incompatibility in that Expo module, upstream of this app, not something to patch here.
  Confirmed environment-wide, not specific to one machine or author (another engineer hit the
  identical failure on the same Xcode build independently). If you hit this, install an older
  Xcode side-by-side and `xcode-select -s` it before building; there is no app-level fix.
  `.github/workflows/e2e.yml` pins Xcode 16.4 for exactly this reason — see that workflow's
  comments for the exact version and the GitHub runner-image doc it's pinned from. Also:
  `expo run:ios --device "<name>"` can fail Xcode's own destination matching for every concrete
  simulator device while still listing "Any iOS Simulator Device" as valid — if so, build once
  with an explicit generic destination
  (`xcodebuild ... -destination "generic/platform=iOS Simulator"` from `ios/`) to warm Xcode's
  device-destination cache, then retry the named-device build.
- **Android (optional, "if feasible"):** not set up in a bare macOS checkout by default and isn't
  in this one either — no `$ANDROID_HOME`, no `emulator` binary. The flow YAML under `.maestro/`
  is platform-agnostic Maestro syntax and needs no changes to run against Android; what's missing
  is the Android SDK + an AVD (emulator image) on the machine running it. `npm run e2e:android`
  fails fast with this same message rather than attempting a multi-GB SDK/emulator install as a
  side effect of a release check. Set up an AVD once (Android Studio, or
  `sdkmanager`/`avdmanager` from the command-line tools) and the same scripts work unchanged.

## Build variants

This app has two independent env-driven gate switches, `EXPO_PUBLIC_DEMO` and
`EXPO_PUBLIC_CAMERA_DEMO`, and they behave very differently from what their names might suggest:

- **`DEMO_MODE` (`EXPO_PUBLIC_DEMO=1`) skips the gate chain entirely** — `profile-context.tsx`
  pre-resolves `route='home'` and never calls Supabase, so age-gate and consent **never render
  at all**, the app launches straight to Home. It does **not** gate the Shop/bag/checkout
  surface — that's a separate flag (`SUPABASE_OFFLINE`, below) — so a DEMO_MODE build with real
  Shopify credentials reaches live Shopify Storefront traffic with zero Supabase involvement.
- **`CAMERA_DEMO` (`EXPO_PUBLIC_CAMERA_DEMO=1`) is the opposite**: the real age-gate/consent
  screens render and need real taps, persisted to local state instead of Supabase
  (`src/lib/camera-demo-profile.ts`) — this is what makes `/scan` reachable (DEMO_MODE blocks
  it). `SUPABASE_OFFLINE` is defined as `== CAMERA_DEMO`, and it unconditionally forces every
  Shopify screen (`ShopifyShopScreen`/`ShopifyProductScreen`/`ShopifyBagScreen`) into
  `ShopOfflineNotice`, regardless of what the Shopify env vars say.

No single build exercises every flow, so E2E runs as **four separate local builds**, each a
plain `expo run:ios` dev-client build (not an EAS cloud build, not TestFlight), each with its own
`.maestro/<variant>/` flow directory:

| Variant | Env | What it covers | Why this shape |
|---|---|---|---|
| `demo` | `EXPO_PUBLIC_DEMO=1` + real `EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN`/`STOREFRONT_TOKEN`/`CHECKOUT_HOSTS` | Flow 3a: catalogue load · Flow 4: add to bag · Flow 5: checkout hand-off (stops the instant the Shopify checkout sheet opens) | Lands on Home with no gate taps and no Supabase traffic at all; the Shop tab is never demo-gated, so real Shopify browsing/cart/checkout-sheet is reachable with zero Supabase writes. Confirmed `src/features/commerce/shopify/*.ts` never imports the Supabase client for writes. |
| `shopify-offline` | same as `demo`, but `EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN=offline.invalid` | Flow 3b: catalogue retry state | Maestro's `setAirplaneMode` is **Android-only** and silently no-ops on iOS Simulator (there's no simulator airplane mode) — confirmed against Maestro's own docs before relying on it. An unreachable host at build time is the only deterministic way to force the retry UI on iOS; this reuses the exact pattern `eas.json`'s `testflight-camera` profile already uses. |
| `camera-demo` | `EXPO_PUBLIC_CAMERA_DEMO=1`, Supabase + Shopify both pointed at `offline.invalid` (= eas.json `camera-demo`/`testflight-camera`) | Flow 1: first launch + consent (real tappable age-gate/consent) · Flow 6: camera permission denied · Flow 7: camera-offline build makes no network calls | The only build where the gate screens are real AND `/scan` mounts `<Capture>`. Everything stays offline by construction, same flag the three-principal dogfood build uses (`docs/ops/camera-on-testflight-compliance.md`) — never uploaded or distributed, local Simulator only. |
| `camera-demo-fixture` | same as `camera-demo`, plus `EXPO_PUBLIC_E2E_FIXTURE_SCAN=1` | Flow 2 (Simulator/CI-safe variant): camera scan to shade match | A **separate build** from plain `camera-demo` — see "Flow 2" below for why it can't share a binary with flows 1/6/7. |

`scripts/e2e/build-variant.sh <variant>` sets the right env and runs `expo run:ios`;
`scripts/e2e/run-maestro.sh <variant>` builds (unless `--skip-build`) then runs that variant's
flow directory; `scripts/e2e/run-all.sh ios` loops all four and prints a pass/fail table.

**Flow 7's network-silence check runs automatically, local and CI (Toby review finding 2,
HAG-231).** `run-maestro.sh` runs `camera-demo`/`camera-demo-fixture`'s
`07_offline_no_network.yaml` through `scripts/e2e/assert-no-network.sh` rather than through plain
`maestro test` — it used to be a separate, on-request-only script that neither this runner nor
`e2e.yml` ever actually called, so a background request could slip through flow 7's UI-only
assertion undetected. The check now allowlists what's actually expected (the build-forced
`offline.invalid` host, loopback, and iOS's own unrelated connectivity/push noise) and fails on
*any other* dotted hostname seen in the app's own log during the flow, not just a fixed list of
known Supabase/Shopify hosts.

## Flow 2 — camera scan to shade match

Two variants exist, because the Simulator genuinely cannot drive a live camera (CLAUDE.md §4:
"The iOS Simulator has no camera → the scan flow MUST be tested on a physical iPhone") — there was
no existing way around that, so this adds one, scoped exactly to HAG-231's decision:

- **`.maestro/camera-demo-fixture/02_camera_scan_to_shade_match_fixture.yaml`** (Simulator/CI-safe,
  runs today). Gated by a new `src/lib/e2e-fixture.ts::E2E_FIXTURE_SCAN` flag
  (`EXPO_PUBLIC_E2E_FIXTURE_SCAN=1`, **AND**ed with `__DEV__` so it is structurally unreachable on
  any Release/TestFlight/App Store/EAS-non-development build regardless of the env var — see that
  file's test, `src/lib/__tests__/e2e-fixture.test.ts`, which is the RED/GREEN TDD gate god asked
  for). `app/scan/index.tsx` substitutes a **synthetic, not-a-real-person** fixture image for the
  capture step only — see `src/features/capture/e2e-fixture-image.ts`: it's generated from the
  SAME synthetic-face builder the fairness self-test already uses
  (`eval/fairness/self-test-images.ts`'s `renderSelfTestFace('III')`), base64-embedded, written to
  a real file via `expo-file-system` at runtime, then handed to the exact same `handleCaptured()`
  the real camera uses. Everything downstream (on-device read, shade derivation, persistence,
  image-cleanup, no-egress) is the real, unmodified pipeline. Does **not** revive `runStubRead()`.
  Needs its own build (`camera-demo-fixture`), separate from plain `camera-demo`: flow 6 needs the
  real `<Capture>` permission-denied UI, which `E2E_FIXTURE_SCAN` would skip entirely if both were
  in the same binary.
  - **Fixture decode provenance (Dwight review, HAG-231).** The embedded base64 must decode with
    the exact codec+options the production read path uses (`jpeg.decode(bytes, { useTArray: true,
    formatAsRGBA: true })`, `src/features/read/decode-rgb.ts`) at exactly 120×120 — a broken image
    makes `run-read.ts`'s outer catch silently fall back to `stubRead()` in `__DEV__`, so the flow
    could reach "We found your match" without exercising the real read at all.
    `src/features/capture/__tests__/e2e-fixture-image.test.ts` decodes the committed string and
    pins its SHA-256, so a hand-edit or a bad regeneration fails that test immediately. Regenerate
    only with the exact command in `e2e-fixture-image.ts`'s header comment, never by hand-editing
    the base64.
  - **Persistence proof (Toby review finding 1, HAG-231).** The result-screen assertions
    (`"We found your match"` / `"Your shade"`) only prove the shade was *published*, not *saved* —
    `run-read.ts` calls `personalization.setScan(shade)` before `persist()` is awaited, so the
    screen renders success even if the save afterwards fails. The flow now also taps
    Account → Scan History and asserts a saved match actually appears there
    (`"Recent scans"` visible, `"Shade removed"` not), reading back through the real
    `fetchScanHistoryPage()` → on-device scan store (`src/lib/scans.ts`). That this is a real,
    non-vacuous check (not just a second screen that would pass the same way) is proven at the
    unit level in `src/features/read/__tests__/run-read.test.ts` using the E2E-only
    `src/lib/e2e-force-persist-failure.ts` seam (same `__DEV__`-AND gate as `E2E_FIXTURE_SCAN`):
    forcing persistence to fail still publishes the shade but never calls `recordScan`, which is
    exactly the state the new assertion is designed to catch. The underlying premature-success
    behavior itself is a real app finding, reported separately — not something this branch fixes.
- **`.maestro/physical-device/02_camera_scan_to_shade_match.yaml`** (physical iPhone, the one that
  proves the real camera works). Run with
  `maestro test --device <physical-device-udid> .maestro/physical-device/` against the real
  `camera-demo` build direct-installed to a device you own (never TestFlight/App Store — see
  `docs/ops/camera-on-testflight-compliance.md` §9/§12). Not automated by any script here since it
  needs a connected device; keep it current by hand when the scan/result screens change.

Dwight (biometric boundary) and Toby review the fixture-gate diff before it merges — it touches
`app/scan/index.tsx` and adds new files under `src/features/capture/`/`src/lib/`, not just a
testID.

## Flows 3/4/5 — live Shopify Storefront, with limits

These hit the **real** Shopify store (not a mock, not the old `/bag`+`/checkout` fake-order
route — see note below) because that route is the only one that actually calls
`@shopify/checkout-sheet-kit`'s real native checkout sheet, which is what "Shopify checkout
hand-off" means. Approved (HAG-231) with these limits, all enforced in the flow YAML itself:

- **Storefront reads and cart create/update only.** No customer login, no email, no address, no
  payment field — flow 5 stops the instant the checkout sheet is confirmed open and dismisses it
  (swipe-down, the standard iOS modal-sheet gesture, with an optional "Done" tap tried first) —
  nothing is ever tapped or typed **inside** the sheet.
- **No Admin API calls anywhere** — only the public Storefront API, same as the app's own runtime.
- **The product under test is picked dynamically** (`shopify-product-.*`, the first rendered
  tile) — its handle comes from whatever the live catalogue returns that run, never hard-coded,
  and no flow asserts a specific price or stock level (only the "Guest checkout · <price>" /
  "Add to Shopify bag · <price>" button text as a regex, never a literal amount).
- **These flows need real network and leave a throwaway cart behind in the live store on every
  run** — that's expected, not a bug; there's no cart-cleanup step because the Storefront API has
  no delete-cart call and an abandoned cart has no cost.
- **The old `/bag` + `/checkout` route is DEMO_MODE-only and is NOT covered by any of these
  flows.** It's a fully separate, TrueTone-authored fake-order screen (fake order number, zero
  network, zero Shopify involvement — `app/bag.tsx` renders it only when `catalogueIsDemo`
  (`== DEMO_MODE`) is true) that doesn't exercise Shopify at all, so it doesn't satisfy "Shopify
  checkout hand-off" and isn't exercised here.

## Shopify credentials (`demo` build only)

`demo` is the one variant that needs real `EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN` /
`EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` / `EXPO_PUBLIC_SHOPIFY_CHECKOUT_HOSTS` values.
`scripts/e2e/build-variant.sh demo` reads them from wherever they already are in your shell
environment, OR from a file named by `TT_ENV_FILE` (default: unset — nothing is read):

```bash
TT_ENV_FILE=/path/to/TrueTone/.env bash scripts/e2e/run-maestro.sh demo
```

This never copies, reads into this repo, or commits that file — it `grep`s exactly those three
keys out of it into the build process's own environment and nothing else, and the script never
echoes or logs their values (`set +x` is on throughout). Do not point `TT_ENV_FILE` at a file you
don't want parsed this way, and never check a real `.env` into this repo. In CI,
`.github/workflows/e2e.yml` reads the same three names from GitHub Actions secrets instead.
`shopify-offline` and `camera-demo`/`camera-demo-fixture` need no credentials at all.

## Running it

```bash
npm run e2e:ios                     # all four variants, builds each fresh, prints a summary
npm run e2e:ios:demo                # flows 3a/4/5 (needs Shopify creds — see above)
npm run e2e:ios:shopify-offline     # flow 3b
npm run e2e:ios:camera-demo         # flows 1/6/7
npm run e2e:ios:camera-demo-fixture # flow 2 (Simulator/CI-safe)
npm run e2e:android                 # fails fast with setup instructions until an AVD exists
# flow 2, physical device (not run by any npm script):
maestro test --device <udid> .maestro/physical-device/
```

Each `expo run:ios` build is a full native compile the first time (vision-camera, executorch,
the Shopify checkout sheet kit are all native modules) — expect several minutes per variant on a
cold cache; Xcode incremental builds make repeat runs much faster.

## Pre-release check

`scripts/e2e/run-all.sh ios` is the pre-release script: run it before cutting a release build and
treat any `FAIL` row as a release blocker. It is intentionally **not** a required GitHub Actions
check yet — see `.github/workflows/e2e.yml` for why (macOS CI runners can build this, but a full
four-variant native build-and-test pass is slow and not free-tier-friendly; it's wired as a
manually-triggered workflow you run before a release, not a per-PR gate).
