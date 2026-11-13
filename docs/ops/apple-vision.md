# Apple Vision face detection

iOS uses the local `@truetone/apple-vision` Nitro module for live frames and captured stills. It calls Apple's `VNDetectFaceRectanglesRequest` on the ordinary camera path, not TrueDepth, ARKit or face recognition. There is no network client, tracking identifier, file writer or third-party detector. Each invocation owns its request and releases image references when it returns. Existing capture-frame disposal and `withImageCleanup` still own frame/photo cleanup on success and failure.

The ML Kit wrapper, its patch and its resolved dependency are removed globally. Android has no approved replacement. Capture shows "Not supported on this device yet" with a back action before mounting any camera, requesting permission or starting detector hooks, including the dev-force path. It does not silently run ML Kit or switch to simulated face metrics. Existing explicitly selected synthetic UI/e2e modes remain separate from real detection.

## Coordinate contract

Vision reports normalized lower-left bounds and pose angles in radians. The native core converts to upright, top-left normalized bounds and degrees. EXIF orientations 1–8, including mirrored orientations, determine the upright image dimensions. The live bridge uses the frame's orientation/mirror metadata. The front preview adapter mirrors once and projects into the centered aspect-fill viewport; still bounds map directly into the upright file's pixel dimensions. Missing pose or invalid bounds cannot pass the live face gate.

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

## Release gates not satisfied by host tests

- No real face or device testing is authorized for this implementation task.
- Before non-principal testing or launch, review the built iOS dependency graph and obtain the approved physical-iPhone capture network proof: no Google/third-party requests before, during or after capture. Run only with the legally approved identities/cohort and offline build.
- On the same approved device, check upright and mirrored front-camera geometry, preview aspect-fill cropping, pose gating, still pixel alignment and cleanup on success/error. Include portrait orientations and rotation transitions. Do not persist faces or geometry as test evidence.
- A new native binary is required. An over-the-air JavaScript update cannot remove old linked pods. Do not reuse a previously built ML Kit binary as evidence.

Apple's contracts: [face observation and radians](https://developer.apple.com/documentation/vision/vnfaceobservation), [landmark coordinate origin](https://developer.apple.com/documentation/vision/vnfacelandmarks2d), [Vision face tracking example](https://developer.apple.com/documentation/vision/tracking-the-user-s-face-in-real-time). Those describe API behavior, not device verification of this adapter.
