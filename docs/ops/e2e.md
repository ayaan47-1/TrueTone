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
  `.github/workflows/e2e.yml` pins an exact Xcode/runtime/device triple for exactly this reason —
  see that workflow's comments for the full three-way reasoning (Expo SDK 56's documented Xcode
  floor, the Swift-version ceiling, and which Simulator runtime actually has the requested
  device) and the citations it pins from.
  - **Resolve the Simulator by device name AND runtime together, not name alone** (Toby
    re-review finding 1, HAG-231). A device name like "iPhone 17" can exist under more than one
    installed iOS runtime at once — `scripts/e2e/run-maestro.sh` and `scripts/e2e/run-all.sh`
    both now take an optional runtime argument (default `iOS 26.4`, matching the CI pin) and
    fail loudly, printing every installed device, if that exact name+runtime pair isn't found,
    instead of silently booting whichever same-named device a bare `grep` saw first. The
    resolution logic lives in `scripts/e2e/lib/simulator-resolve.sh`, unit-tested in
    `scripts/e2e/lib/__tests__/simulator-resolve.test.sh` (`npm run e2e:test-scripts`) against
    synthetic `xcrun simctl list devices` output — no simulator needs to be running to test it.
  - `expo run:ios --device "<name>"` can still fail Xcode's own destination matching for every
    concrete simulator device while listing "Any iOS Simulator Device" as valid — if so, build
    once with an explicit generic destination
    (`xcodebuild ... -destination "generic/platform=iOS Simulator"` from `ios/`) to warm Xcode's
    device-destination cache, then retry the named-device build. This is a separate, narrower
    quirk than the name+runtime resolution above (which governs which Simulator Maestro talks
    to, not which one `expo run:ios` installs onto) and hasn't recurred since the runner moved
    to `macos-26` locally-equivalent toolchains, but is left here as a known workaround.
  - **The resolved UDID is passed to every build/test call, not just used to boot the right
    simulator** (Toby re-review, HAG-231 round 5). Resolving by name+runtime (above) only chooses
    which simulator `run-maestro.sh` boots; `expo run:ios --device "<name>"` and
    `maestro test` were still called with the bare NAME, so Expo's own device resolver
    (`findDeviceFromSearchValue` in `@expo/cli`, matches name OR udid) or Maestro could still
    pick a *different*, same-named simulator already booted under another runtime. `run-maestro.sh`
    now passes the resolved `$SIMULATOR_UDID` through to `build-variant.sh` (which uses it for
    `expo run:ios --device <udid>` when given one) and to every `maestro test --device <udid>`
    call, including inside `assert-no-network.sh` (now `assert-no-network.sh <device-udid>
    <flow-path> [<flow-path> ...]`), so the exact resolved simulator is what actually runs,
    not just what gets booted.
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

**The network-silence check runs automatically, local and CI, for BOTH offline builds (Toby
review finding 2, re-review finding 2; Dwight re-review round 5, HAG-231).** Whenever a variant
directory has `07_offline_no_network.yaml`, `run-maestro.sh` runs **every flow in that directory
— not just flow 7 — inside one continuous `scripts/e2e/assert-no-network.sh` log capture**,
selected by `scripts/e2e/lib/flow-selection.sh::select_monitored_flows`, rather than through plain
`maestro test`. It used to run every other flow unmonitored and wrap only flow 7 by itself
afterward; for `camera-demo-fixture` that left the fixture scan (flow 2 — the one flow that
actually exercises the capture/read/persist path) completely outside the capture window, since
flow 7 opens a fresh app instance and never touches that path — a fixture-only outbound request
could slip through undetected while the job still passed. `camera-demo` had the identical
structural gap (flows 1/6 ran unmonitored, only flow 7 was wrapped) and is fixed the same way.
`camera-demo-fixture` previously had no `07_offline_no_network.yaml` of its own at all (it's a
separate build from `camera-demo` — see the variant table above), so it silently skipped the
check entirely; it now has one
(`.maestro/camera-demo-fixture/07_offline_no_network.yaml`, same offline-host assertion as
`camera-demo`'s).

The check allowlists only what's genuinely expected — loopback (needed for the debug harness)
and iOS's own unrelated connectivity/push noise — and fails on *any other* dotted hostname seen
in the app's own log during the capture window, not just a fixed list of known Supabase/Shopify
hosts. **`offline.invalid` is deliberately NOT in that allowlist** (Dwight re-review round 5,
HAG-231): it's the build-forced Shopify/Supabase host (`scripts/e2e/build-variant.sh`) used to
make the app structurally unable to reach a real endpoint, but under the HAG-230 zero-network
contract `CAMERA_DEMO` makes no network calls at all — a DNS/connection attempt to that sentinel
is itself the regression this check exists to catch, not a permitted destination.
**Every entry in the allowlist is matched against the WHOLE extracted hostname, never a
substring** (Toby re-review finding 3, HAG-231): the filtering previously used unanchored
`grep -viE`, so a logged host like `offline.invalid.attacker.example` or
`127.0.0.1.evil.example` was silently dropped from the suspicious list for merely *containing* an
allowed host, even though it's a different, attacker-controlled destination.

**The capture runs as TWO separate log streams, each kept in its own file, not merged (Dwight
re-review round 5, re-review of `e83ef82`).** `assert-no-network.sh` used to `OR` an
app-process-scoped predicate (`processImagePath CONTAINS` the bundle id) together with a
generic system-wide one (`subsystem == "com.apple.network"`, which also carries unrelated
traffic from every other process on the machine) into one `log stream` call, flattened into one
text blob. Once merged, there was no way to tell which captured hostname came from which stream,
so the OS-noise exemption (Apple/Crashlytics domains, needed to keep the generic stream from
drowning the check in unrelated system noise) applied to BOTH — silently exempting an
app-originated request to one of those domains exactly like real system noise, which defeats
the zero-network contract. The fix runs two independent `log stream` processes (one per
predicate) into two files, so attribution is preserved at the source instead of re-derived from
log text afterward: the app-attributed stream is scanned with the strict
`filter_app_attributed_suspicious_hosts` (loopback only — no OS-noise exemption, since a line
the OS already scoped to this app's own process can't be "someone else's" traffic by
definition), and only the generic system-wide stream keeps the OS-noise-exempting
`filter_suspicious_hosts`.

**The generic/system-wide stream's own predicate is further scoped so OS-noise exemption needs
POSITIVE evidence of a non-TrueTone process (Dwight re-review round 6, HAG-231).** The round-5
stream split still let the generic stream's `log stream --predicate 'subsystem ==
"com.apple.network"'` capture ANY line on that subsystem with no process check at all, so OS-noise
exemption applied regardless of attribution — not just to genuinely-other-process traffic. The
predicate is now built by `scripts/e2e/lib/network-allowlist.sh::build_system_noise_predicate`:
`subsystem == "com.apple.network" AND processImagePath != "" AND NOT (processImagePath CONTAINS
<bundle-id>)` — a real, non-empty process attribution that explicitly isn't this app (fields and
operators confirmed via `log help predicates`: `processImagePath` is a string field; `!=`,
`CONTAINS`, `NOT` are supported). An unattributed line or one attributed to this app can never
reach the exemption-eligible stream at all now.

**Both predicates above matched the wrong thing entirely, and the capture ran on the wrong
machine (Toby re-review round 7, HAG-231, review-toby.md "Re-review at `00072e0`").**
`processImagePath` is a filesystem path to the running *binary* (e.g. `.../TrueTone.app/TrueTone`),
not the bundle identifier — a path like that never contains `com.ayaan47.truetone`, so both the
app-attributed predicate and the system-noise predicate's exclusion clause matched zero lines
from the app's real process on a device; the capture also ran `log stream` on the **host**, not
the resolved Simulator, so even a correct predicate would have observed the wrong machine's
traffic. The fix is two changes: (1) `scripts/e2e/lib/app-executable.sh::resolve_app_executable_name`
resolves the installed app's actual executable name per run — `xcrun simctl get_app_container
<udid> <bundle-id> app` finds the `.app` on the **resolved simulator**, then `plutil -extract
CFBundleExecutable raw` reads its real name straight out of that bundle's `Info.plist` (never
hardcoded, since `CFBundleExecutable` can change); `assert-no-network.sh` fails closed (no
capture started at all) if this can't be resolved. (2) Both predicates now take that executable
name and match `processImagePath ENDSWITH "/<name>"` (the exact trailing path component, not a
substring), and both `log stream` calls run as `xcrun simctl spawn "$DEVICE_UDID" log stream
...` — spawned ON the resolved simulator, the same device-pinning discipline the build and
Maestro `--device` flags already had (rounds 5–6). Every round-6 fail-closed control (PID
liveness before/after, non-empty app-attributed capture) is unchanged, just reached through the
new call shape. `scripts/e2e/lib/__tests__/app-executable.test.sh` proves the resolver against a
stubbed `xcrun`/`plutil`; `scripts/e2e/__tests__/simulator-log-capture.test.sh` proves end-to-end
that `assert-no-network.sh` actually invokes `simctl spawn <udid> log stream` with the
executable-based predicate, and fails closed before any capture starts when the executable can't
be resolved.

Both filtering functions live in `scripts/e2e/lib/network-allowlist.sh`, unit-tested in
`scripts/e2e/lib/__tests__/network-allowlist.test.sh` (including an explicit TrueTone→`apple.com`
case and predicate-string assertions for `build_system_noise_predicate`/
`build_app_attributed_predicate`); the flow-selection logic lives in
`scripts/e2e/lib/flow-selection.sh`, unit-tested in
`scripts/e2e/lib/__tests__/flow-selection.test.sh` against synthetic temp directories (no
simulator needed); the device-UDID pinning through `build-variant.sh`/`maestro test` (Toby
re-review, HAG-231 round 5 — see "Prerequisites" above) is proven by
`scripts/e2e/__tests__/device-pinning.test.sh`, which stubs `npx`/`maestro`/`xcrun`/`log`/`plutil`
with fake executables that record their argv instead of touching a real Simulator. All of these
run via `npm run e2e:test-scripts`.

**The check fails closed on three distinct capture/build failure modes, not just a suspicious
hostname (Toby re-review round 6, 2 HIGHs).** Previously: (1) `run-maestro.sh` never checked
`build-variant.sh`'s exit status, so a failed Expo build could fall straight through to the
Maestro run and report PASS against whatever app was already installed; (2) `assert-no-network.sh`
never checked whether its `log stream` processes actually started or stayed alive, so a capture
that failed to start (permissions/log-service issue) or died mid-run produced an empty file —
indistinguishable from a genuinely clean capture, and the check passed either way. Both scripts
now use `set -euo pipefail` plus explicit checks (wrapped in `if`/`||` where a status needs to be
inspected rather than let `-e` abort on, which bash's `-e` rules exempt): `run-maestro.sh` stops
immediately if `build-variant.sh` fails; `assert-no-network.sh` checks both `log stream` PIDs are
alive right after starting (fails if either already exited) and again right before the
deliberate kill at the end (fails if either died mid-run), and separately requires the
app-attributed capture file to be non-empty (`[ -s "$APP_LOG_FILE" ]` — a running app always
emits *some* log activity, so a totally empty app-attributed capture means the capture mechanism
itself is broken, not that the app was silent; the generic system-wide stream is **not** held to
this rule, since a short run with no activity from any other process is a normal, expected
result). `scripts/e2e/__tests__/fail-closed.test.sh` proves all three failure modes (log stream
dead on arrival, log stream dies mid-run, log stream alive but silent) plus the build-failure
case, each via stub executables, alongside a no-regression case proving the healthy path still
passes. A fourth fail-closed mode added in round 7 — the installed app's executable name can't
be resolved at all (see above) — is checked *before* any of these, since no capture can start
without it; `scripts/e2e/__tests__/simulator-log-capture.test.sh` proves that case.

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
  - **Fixture decode provenance (Dwight review, HAG-231, fixes (a)/(b)/(c)).** The embedded base64
    must decode with the exact codec+options the production read path uses (`jpeg.decode(bytes, {
    useTArray: true, formatAsRGBA: true })`, `src/features/read/decode-rgb.ts`) at exactly
    120×120, and must byte-for-byte match a FRESH call to the single-source generator
    (`src/features/capture/e2e-fixture-generator.ts`'s `buildE2EFixtureJpeg()`) — not a frozen
    pinned hash someone could update to match a bad regeneration.
    `src/features/capture/__tests__/e2e-fixture-image.test.ts` asserts both. Regenerate with
    `npm run e2e:regen-fixture` (the committed script at
    `eval/fairness/__tests__/e2e-fixture-generator.regen.test.ts`, gated behind
    `REGEN_E2E_FIXTURE=1` so a plain `npm run test:eval` never touches the committed file) —
    never by hand-editing the base64.
    `src/features/capture/__tests__/e2e-fixture-real-pipeline.test.ts` goes one step further:
    it runs the fixture through every REAL pure step `cv-read-engine.ts`'s device wrapper runs
    (decode → orientation → downscale → regions → `scoreFromRgb` → `deriveShade`) and pins the
    exact resulting shade name (`"Light Warm"`) — which `.maestro/camera-demo-fixture/
    02_camera_scan_to_shade_match_fixture.yaml` also asserts on-device, as a marker only a
    genuine run of the real pipeline on the real fixture bytes can produce (unlike the static
    page headers). `run-read.ts`'s `__DEV__` stub fallback is also now disabled whenever
    `E2E_FIXTURE_SCAN` is on (`src/lib/e2e-fixture.ts`), so any decode/engine failure fails the
    flow loudly instead of silently substituting a stub.
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
