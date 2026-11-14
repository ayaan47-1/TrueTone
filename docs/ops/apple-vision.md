# Apple Vision face detection

iOS uses the local `@truetone/apple-vision` Nitro module for live frames and captured stills. It calls Apple's `VNDetectFaceRectanglesRequest` on the ordinary camera path, not TrueDepth, ARKit or face recognition. There is no network client, tracking identifier, file writer or third-party detector. Each invocation owns its request and releases image references when it returns. Existing capture-frame disposal and `withImageCleanup` still own frame/photo cleanup on success and failure.

The ML Kit wrapper, its patch and its resolved dependency are removed globally. Android has no approved replacement. Capture shows "Not supported on this device yet" with a back action before mounting any camera, requesting permission or starting detector hooks, including the dev-force path. It does not silently run ML Kit or switch to simulated face metrics. Existing explicitly selected synthetic UI/e2e modes remain separate from real detection.

## Coordinate contract

Vision reports normalized lower-left bounds and pose angles in radians. The native core converts to upright, top-left normalized bounds and degrees. EXIF orientations 1–8, including mirrored orientations, determine the upright image dimensions. The live bridge uses the frame's orientation/mirror metadata. The front preview adapter mirrors once and projects into the centered aspect-fill viewport; still bounds map directly into the upright file's pixel dimensions. Missing pose or invalid bounds cannot pass the live face gate.

Pose remains optional in the native result. Still-image region placement requires only valid bounds, so unknown yaw/roll never discards a measured still box or silently becomes zero degrees. Preview validation separately requires finite yaw and roll. Positive mapping tests inject `VNFaceObservation` through test-only methods compiled with `APPLE_VISION_TESTING`. Production entry points cannot accept an injected performer. Neither this flag nor the host-only interfaces are included by the podspec.

Host tests also compile the actual `HybridAppleVisionDetector` Swift source and call its `detectStill` and `detectFrame` entry points with a temporary blank EXIF-7 JPEG and a synthetic mirrored/rotated sample buffer. Both call the real `VNImageRequestHandler.perform` with a real face-rectangle request, then return upright dimensions and an empty face array through the bridge mapper. A test-only counter increments after successful request execution, so a silent empty-result shortcut fails these tests. SwiftPM substitutes only Nitro/VisionCamera interface types unavailable on macOS. This does not exercise generated JSI/C++ interop or positive portrait detection. The unsigned iOS build and physical-iPhone positive detection remain blocking release gates.

Vision rectangles do not provide the old detector's cheek/forehead contours. The still read uses its existing explicit detected-bounds fallback, not fabricated contour points. This changes the available geometry and requires the physical-device mapping check below before release. No accuracy or fairness claim follows from synthetic tests.

## Reproduce the checks

```sh
npm ci
npm run generate:apple-vision
git diff --exit-code -- packages/apple-vision/nitrogen
npm test -- --runInBand --coverage
npm run test:scripts
npm run check:compliance
npm run check:no-egress
swift test --package-path packages/apple-vision
EXPO_NO_DOTENV=1 SENTRY_DISABLE_AUTO_UPLOAD=true npx expo prebuild --platform ios --no-install
SENTRY_DISABLE_AUTO_UPLOAD=true pod install --project-directory=ios
npm run check:apple-vision -- --native
```

Nitrogen 0.35.9 is pinned as a build tool. Generated bindings are committed so an app build does not need to regenerate them. The macOS CI job pins Xcode 26.4.1 on macos-26 and verifies generation, host Swift tests, the generated `ios/Podfile.lock` and an unsigned native build. The guard rejects the RN wrapper, ML Kit pods, GoogleDataTransport and Firebase Analytics. `--native` fails if the lockfile is missing; static manifest checks alone are not proof of the shipped native graph. The pod's privacy manifest declares no collected data, tracking or required-reason APIs. App Store disclosures must reflect the final built graph and counsel-reviewed face processing; do not claim this makes all processing exempt from biometric law.

**Local Xcode 27.2 (Swift 6.4.2) builds (HAG-239).** The "Reproduce the checks" steps above also pass on a Mac with only Xcode 27.2 installed, via two small fixes that ship unconditionally (they don't change CI's Xcode 26.4.1 behavior): (1) `plugins/withIOSDeploymentTargetFix.js`, an Expo config plugin that sweeps every target in the generated `ios/Podfile`'s `post_install` block, not just the library targets react-native's own `updateOSDeploymentTarget` touches — CocoaPods' auto-generated resource-bundle/privacy-manifest sub-targets for `RNCAsyncStorage`, `react-native-view-shot` and `ShopifyCheckoutSheetKit` keep each pod's own old deployment target (9.0/13.0/13.4), which Xcode 27's SDK rejects outright (floor is 15.0); (2) `expo-modules-jsi` pinned to `56.0.14` via a root `overrides` entry (still inside `expo-modules-core`'s own `~56.0.10` range — no Expo SDK bump needed) — 56.0.10's `JavaScriptRuntime.swift` forms a C function pointer from inside a ternary expression, which Swift 6.4.2 rejects; 56.0.14 binds the pointer to a typed variable first, which Swift 6.4.2 accepts.

## Release gates not satisfied by host tests

- No real face or device testing is authorized for this implementation task.
- Positive detection through the real Vision request and generated Nitro bindings must be demonstrated on an approved physical iPhone before release. Blank inputs and injected observations cannot prove that a portrait is detected.
- Before non-principal testing or launch, review the built iOS dependency graph and obtain the approved physical-iPhone capture network proof: no Google/third-party requests before, during or after capture. Run only with the legally approved identities/cohort and offline build.
- On the same approved device, check upright and mirrored front-camera geometry, preview aspect-fill cropping, pose gating, still pixel alignment and cleanup on success/error. Move the face to the left and right edges and test rotation transitions. The preview's one-mirror assumption is not proved by host tests; if device evidence contradicts it, pass the actual mirror state rather than changing the transform by guesswork. Do not persist faces or geometry as test evidence.
- A new native binary is required. An over-the-air JavaScript update cannot remove old linked pods. Do not reuse a previously built ML Kit binary as evidence.

Apple's contracts: [face observation and radians](https://developer.apple.com/documentation/vision/vnfaceobservation), [landmark coordinate origin](https://developer.apple.com/documentation/vision/vnfacelandmarks2d), [Vision face tracking example](https://developer.apple.com/documentation/vision/tracking-the-user-s-face-in-real-time). Those describe API behavior, not device verification of this adapter.
