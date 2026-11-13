# Configure crash reporting

This branch reports JavaScript unhandled errors and rejected promises through `@sentry/react-native` 8.35.0. Native crashes and hangs are disabled because native reports can bypass JavaScript privacy filters. Crash reporting remains off until a Data Source Name (DSN) is supplied.

## Before enabling a production build

1. Complete the vendor and counsel approval in the Sentry vendor review. Use a US-region organization, a signed Data Processing Addendum, and retention of no more than 30 days. Disable IP storage and geographic enrichment, and retain server-side scrubbing as a second defense. Update privacy disclosures and App Store privacy answers before distribution.
2. Create a React Native project in Sentry. Put its public DSN in `EXPO_PUBLIC_SENTRY_DSN` in your local environment or the production EAS environment. Only this variable can enable the runtime. Do not use `SENTRY_DSN` as an alternative.
3. Configure `SENTRY_ORG` and `SENTRY_PROJECT` for source-map uploads. Store `SENTRY_AUTH_TOKEN` as an EAS build secret. Never prefix this token with `EXPO_PUBLIC_`, put it in Expo plugin options, or commit it. The plugin reads only token presence to decide whether to permit uploads.
4. Build a new native binary. The Expo plugin and Metro source-map integration are not an over-the-air-only dependency change. Uploads are disabled without a token, without a DSN, in demo or camera builds, in fixture mode, and in non-production EAS profiles.
5. Inspect an approved physical-iPhone smoke test before release. Check an unhandled JavaScript error and rejection, a scan failure, and a forced native crash followed by relaunch. Native crashes must send nothing. Verify symbolication against the uploaded release artifacts. Do not attach a real image or include real personal data in this test.

The agent did not create a Sentry account, send events, edit `.env`, upload source maps, or make a native device build. Physical-device network inspection and dashboard verification remain release gates.

The technical metadata exception permits one UUID build Debug ID and one canonical bundle filename. The local artifact test proves that the ID in a built Hermes bundle and its map survives the real SDK integration and both filters. Source-map upload and dashboard symbolication still need the device smoke test before distribution.

## Runtime contract

- No SDK load or initialization when the DSN is absent, `DEMO_MODE` or `SUPABASE_OFFLINE` is active, `__DEV__` is true, `NODE_ENV=test`, or `EXPO_PUBLIC_E2E` is truthy. Use `EXPO_PUBLIC_E2E=1` for a release-mode synthetic fixture build.
- Only Shop and product/cart surfaces can report. Personalized Home, Account, Community, unknown routes, and sensitive routes cannot report. The root sets the route synchronously before child rendering. After visiting a scan, routine, feedback, setup, consent, data-rights, or developer flow, reporting stays suppressed until process restart. The developer route uses its real group-stripped path `/bbox-overlay`. This sacrifices later crash reports because a bundled asynchronous stack cannot reliably identify its original feature after navigation. Identifiable capture or read stack frames are also rejected.
- The only integrations are JavaScript error handlers and `debugMetaIntegration`. No `Sentry.wrap`, navigation tracking, console capture, network breadcrumbs, sessions, replay, feedback, performance traces, profiling, screenshots, view hierarchy, logs, native initialization, or attachments.
- `beforeSend` first rejects raw keys or values matching the personal, biometric, cosmetic, or account vocabulary. Cyclic or excessive input fails closed. It then reconstructs each remaining technical error from a static error-type allowlist, the fixed message `Crash details redacted`, bundle filename, line and column, random event identifier, and event time. Source values, function names, free-form messages, users, requests, contexts, tags, scores, skin type, shades, matches, routines, emails, account IDs, and URL queries are not copied. All breadcrumbs are dropped. The SDK block is reconstructed from the installed SDK version with `settings.infer_ip: never`; incoming SDK data cannot override it.
- A second raw-data guard and allowlist at the transport boundary cover SDK-internal errors that skip `beforeSend`. The guard checks the original payload before schema projection can hide a sensitive field. It discards non-error envelope items and all incoming envelope headers, reconstructs the technical event including the IP-inference setting, and supplies the app release and production environment. Binary bodies and redirects are refused. No persistent SDK envelope cache is used because the native layer is off. Account-side IP storage prevention and geographic-field removal remain required as a second defense.
- Source locations retain only known bundle basenames or the canonical build filenames below. No local filesystem path or remote URL is sent. Release metadata comes from `app.json`. Confirm source-map matching in the device smoke test before enabling the DSN for users.

## Technical Debug ID exception

Only `debug_meta.images: [{ type: sourcemap, debug_id: <UUID>, code_file: <constant> }]` is permitted. The filename is either `app:///main.jsbundle` or `app:///index.android.bundle`. Extra metadata fields are discarded, malformed IDs and arbitrary filenames do not survive, and frames use the matching canonical filename when valid metadata exists. The raw-data guard exempts only this metadata's structural `images` key and a validated UUID at its specific path. It still rejects sensitive data elsewhere, including extra sensitive metadata fields. A UUID containing hex such as `face` is not mistaken for a free-form face field.

Metro uses `getSentryExpoConfig`, not the generic `withSentryConfig` wrapper, because Expo's serializer needs its Debug ID registration plugin. The artifact regression first failed on the old export: the map had an ID but the Hermes bundle did not contain it. The corrected helper produces the same ID in both artifacts. `debugMetaIntegration` reads that build registration; it does not collect performance or profiling data.

Reproduce the local artifact check without a DSN or upload token:

```sh
crash_artifacts=$(mktemp -d)
EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform ios --source-maps --output-dir "$crash_artifacts"
SENTRY_TEST_ARTIFACT_DIR="$crash_artifacts" npm run test:crash-artifact
```

The test reads the real exported map ID, checks that the Hermes bytecode contains it, then passes it through the installed SDK's actual DebugMeta integration, `beforeSend`, and the final transport. It checks the outgoing ID, canonical frame filename, and IP-inference setting. Transport is in memory; nothing is uploaded. This artifact test is separate from the ordinary Jest and database integration suites because it requires a freshly exported build.

## Local checks

Run `npm test -- --runInBand --coverage`, `npx tsc --noEmit`, `npm run check:compliance`, `npm run check:no-egress`, and `npm run test:scripts`.

The compliance command includes a crash-reporting guard that rejects broader collection options and SDK imports outside the boundary. Regression tests mutate safe flags to prove rejection. An actual Sentry SDK client uses an in-memory transport to verify removal of scope attachments and private context, without contacting Sentry. These tests do not substitute for physical-device network inspection.

`native-disabled.test.ts` exercises the installed SDK's real native wrapper with a substituted device bridge. Across two fresh JavaScript launches, disabled native settings cause zero native initialization, crash-recording, or envelope-delivery calls. A positive control enables the same wrapper and detects native initialization and crash calls, so a disconnected test bridge cannot produce a false pass. A separate test checks the installed Android manifest's `io.sentry.auto-init=false`; the Expo plugin uses `useNativeInit=false` on iOS. This is bridge and configuration evidence, not an actual operating-system crash or native cache/relaunch test. The physical-iPhone check above remains required.

To check generated iOS startup, run `EXPO_NO_TELEMETRY=1 CI=1 npx expo prebuild --platform ios --no-install`, then `node scripts/check-native-crash-config.mjs`. The checker rejects Sentry imports/startup calls in the generated AppDelegate and Sentry options in the generated Info.plist. Its regression test also rejects synthetic unsafe startup configuration. Prebuild generates ignored native files and can update the package's native-run scripts; inspect those incidental edits before committing.

References: [Expo setup](https://docs.expo.dev/guides/using-sentry/), [Sentry options](https://docs.sentry.io/platforms/react-native/configuration/options/), and [client-side privacy filtering](https://docs.sentry.io/platforms/react-native/data-management/sensitive-data/).
