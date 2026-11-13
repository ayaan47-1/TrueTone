import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { checkCrashReporting } from '../check-crash-reporting.mjs';

const runtime = readFileSync('src/lib/crash-reporting/runtime.ts', 'utf8');
test('approved runtime passes; accidental capture integrations fail the static guard', () => {
  assert.deepEqual(checkCrashReporting(runtime), []);
  for (const name of ['attachScreenshot', 'attachViewHierarchy', 'enableNative', 'enableNativeCrashHandling', 'enableLogs', 'sendDefaultPii', 'enableAutoSessionTracking', 'sendClientReports', 'enableNdk', 'enableNativeFramesTracking', 'enableNetworkBreadcrumbs']) {
    assert.ok(checkCrashReporting(runtime.replace(`${name}: false`, `${name}: true`)).length, name);
  }
  for (const call of ['Sentry.setUser({id:"private"})', 'Sentry.addAttachment({})', 'Sentry.startSpan({})', 'Sentry.mobileReplayIntegration()']) {
    assert.ok(checkCrashReporting(`${runtime}\n${call}`).length, call);
  }
});

test('SDK imports in a sensitive module fail the static guard', () => {
  assert.ok(checkCrashReporting(runtime, [{ path: 'src/features/capture/Capture.tsx', text: "import * as Sentry from '@sentry/react-native';" }]).length);
  assert.ok(checkCrashReporting(runtime, [{ path: 'app/scan/index.tsx', text: "require('../src/lib/crash-reporting/runtime')" }]).length);
});

test('only the approved DebugMeta SDK call may be added',()=>{
  assert.deepEqual(checkCrashReporting(`${runtime}\nsentry.debugMetaIntegration()`),[]);
  assert.ok(checkCrashReporting(`${runtime}\nsentry.unapprovedIntegration()`).length);
});

const configure = createRequire(import.meta.url)('../../app.config.js');
test('installed Android SDK manifest disables startup before JavaScript runs', () => {
  const manifest = readFileSync('node_modules/@sentry/react-native/android/src/main/AndroidManifest.xml','utf8');
  assert.match(manifest, /<meta-data\s+android:name="io\.sentry\.auto-init"\s+android:value="false"\s*\/>/);
});

test('Expo plugin never includes auth token; upload is off without keys and in offline/demo/fixture builds', () => {
  const names = ['EXPO_PUBLIC_SENTRY_DSN', 'SENTRY_AUTH_TOKEN', 'EXPO_PUBLIC_DEMO', 'EXPO_PUBLIC_CAMERA_DEMO', 'EXPO_PUBLIC_E2E', 'NODE_ENV', 'EAS_BUILD_PROFILE'];
  const saved = Object.fromEntries(names.map(key => [key, process.env[key]]));
  try {
    for (const name of names) delete process.env[name];
    const plugin = () => configure({config:{plugins:[]}}).plugins[0];
    assert.equal(plugin()[1].disableAutoUpload, true);
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.invalid/1';
    assert.equal(plugin()[1].disableAutoUpload, true);
    process.env.SENTRY_AUTH_TOKEN = 'synthetic-build-token';
    assert.equal(plugin()[1].disableAutoUpload, false);
    assert.equal(plugin()[0], '@sentry/react-native/expo');
    assert.equal(plugin()[1].useNativeInit, false);
    assert.ok(!JSON.stringify(plugin()).includes('synthetic-build-token'));
    for (const key of ['EXPO_PUBLIC_DEMO','EXPO_PUBLIC_CAMERA_DEMO','EXPO_PUBLIC_E2E']) {
      process.env[key] = '1'; assert.equal(plugin()[1].disableAutoUpload,true); delete process.env[key];
    }
    process.env.EAS_BUILD_PROFILE='device-test'; assert.equal(plugin()[1].disableAutoUpload,true);
  } finally {
    for (const [key,value] of Object.entries(saved)) { if(value===undefined) delete process.env[key]; else process.env[key]=value; }
  }
});
