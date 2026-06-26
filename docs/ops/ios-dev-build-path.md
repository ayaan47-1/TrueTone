# iOS Dev-Build Path (personal prototyping)

> **Scope:** how to run TrueTone's scan flow on a **physical iPhone** for *personal prototyping* —
> the iOS mirror of the Android dev build we already run. This path uses a **free personal Apple ID**
> and needs **no LLC / D-U-N-S / Apple Organization**. That heavier path is only for TestFlight +
> public distribution and is tracked separately in
> [`apple-org-enrollment-checklist.md`](./apple-org-enrollment-checklist.md).
>
> Same compliance rules as everywhere (`CLAUDE.md`): the raw face image stays on-device and is
> deleted after the read; only derived scores cross the boundary; no analytics/ad SDKs on the scan
> path. Nothing here relaxes that.

---

## What's already wired (no work needed)

- **Camera permission string** — `ios.infoPlist.NSCameraUsageDescription` is set in `app.json`
  (front-camera-only, "never uploaded, deleted after analysis"). App Review reads this string;
  keep it specific.
- **Bundle identifier** — `ios.bundleIdentifier: "com.ayaan47.truetone"` (added with this doc; matches
  `android.package`). EAS iOS builds fail without it.
- **Deployment target** — `expo-build-properties.ios.deploymentTarget: "16.4"` in `app.json`.
- **EAS dev profile** — `eas.json → build.development.ios.simulator = false`. Correct: the iOS
  **Simulator has no camera**, so the scan flow MUST be a real-device build.
- **Cross-platform code** — the capture screen, frame-metrics gating
  (`FRAME_PROCESSORS_INSTALLED = false`), stub read, and all gates are platform-agnostic. The same
  end-to-end demo path that runs on Android (age-gate → consent → home → camera → auto-capture via
  the scripted simulation → stub-read result) is what will run on iOS.

## Prerequisites

- A **Mac is NOT required for the build** (EAS builds in the cloud). A Mac is only needed if you want
  the local iOS Simulator or native Xcode debugging — and the Simulator can't run the camera anyway.
- A **free Apple ID** is enough for personal device installs. Add it to EAS when prompted, or manage
  credentials interactively. Caveat: apps signed with a **free** (non-paid) Apple ID **expire after
  7 days** and must be rebuilt/reinstalled; the bundle id is also limited. For a smoother prototype,
  a **personal paid Apple Developer membership ($99, Individual)** gives 1-year signing and removes
  the 7-day expiry — still *not* the Organization account, which is only for public distribution.
- A **physical iPhone** on the **same Wi-Fi** as the Mac running Metro.

## Build & run steps

```bash
# 1. Register the iPhone with EAS (one-time per device) — needed for internal/ad-hoc iOS builds.
#    Opens a QR/URL; install the profile on the phone so EAS can target it.
eas device:create

# 2. Build the iOS dev client in the cloud. First run prompts for Apple credentials and provisioning.
eas build --profile development --platform ios

# 3. Install: open the EAS build URL on the iPhone and tap Install (or scan the QR from the build page).
#    First launch: Settings → General → VPN & Device Management → trust the developer profile.

# 4. Start Metro from THIS worktree and open the dev client on the phone.
npx expo start --dev-client --clear
```

`--clear` matters: `EXPO_PUBLIC_*` vars (the Supabase URL) are inlined at bundle time, so restart
Metro after any `.env` change — same rule as Android.

## iOS-specific gotchas

1. **App Transport Security blocks the local-Supabase HTTP URL.** Our dev `.env` points Supabase at
   `http://104.194.124.68:54321` (a plain-HTTP LAN address). **Android allows cleartext in dev; iOS
   does not** — ATS blocks non-HTTPS loads, so auth/scan calls will fail on the iPhone with a
   transport error. Note that address is a public-range IP, so `NSAllowsLocalNetworking` (which only
   covers RFC-1918 private ranges) will **not** cover it. Two ways to fix, in preference order:
   - **Preferred — use HTTPS in dev.** Point `EXPO_PUBLIC_SUPABASE_URL` at an HTTPS endpoint: either a
     **hosted Supabase free-tier dev project** (US region) or an **HTTPS tunnel to local Supabase**
     (`cloudflared tunnel` / `ngrok http 54321`). No app.json change; keeps TLS, which is what
     production needs anyway (`CLAUDE.md` §1 "encrypt in transit").
   - **Local-only fallback — relax ATS for the build.** If you must hit plain-HTTP local Supabase,
     add a **global arbitrary-loads** exception to `ios.infoPlist` and rebuild. **Do NOT commit this
     and never ship it** — it disables transport security app-wide and would violate the TLS rule in
     production. Apply locally, revert before any commit:
     ```jsonc
     // app.json → expo.ios.infoPlist — DEV ONLY, do not commit / do not ship
     "NSAppTransportSecurity": { "NSAllowsArbitraryLoads": true }
     ```
2. **Simulator has no camera.** Always test the scan flow on a physical iPhone (`ios.simulator:false`
   already enforces a device build).
3. **Free-ID 7-day expiry.** A build signed with a free Apple ID stops launching after 7 days —
   rebuild/reinstall, or use a paid Individual membership for the prototype.
4. **Frame processors are still gated.** `FRAME_PROCESSORS_INSTALLED = false`, so iOS runs the same
   scripted-simulation capture + stub read as Android — no `react-native-vision-camera-worklets`
   needed yet. When that flag flips for the real read (production follow-up), iOS needs its own
   on-device calibration: **front-camera mirroring/orientation and the YUV plane layout differ from
   Android**, so `facesToMetrics` mirroring and `SHARPNESS_SCALE` must be re-checked on an iPhone
   using the `__DEV__` metrics overlay.
5. **`expo-dev-client` + New Architecture** are already configured (SDK 56 default); no extra iOS
   setup beyond the steps above.

## What this path does NOT cover

TestFlight, public distribution, and App Review all require the **Apple Developer Organization**
(LLC + D-U-N-S) — see [`apple-org-enrollment-checklist.md`](./apple-org-enrollment-checklist.md).
This doc is strictly the personal on-device prototype loop.
