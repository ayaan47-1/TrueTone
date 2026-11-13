import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNativeCrashConfig } from '../check-native-crash-config.mjs';

test('generated iOS startup rejects native Sentry imports, startup calls and plist options', () => {
  const base = { appDelegate:'import Expo\nclass AppDelegate: ExpoAppDelegate {}', infoPlist:'<plist><dict/></plist>' };
  assert.deepEqual(checkNativeCrashConfig(base),[]);
  for(const code of ['import Sentry','SentrySDK.start(configureOptions: options)','RNSentryStart.start(options: options)']) {
    assert.ok(checkNativeCrashConfig({...base,appDelegate:`${base.appDelegate}\n${code}`}).length);
  }
  assert.ok(checkNativeCrashConfig({...base,infoPlist:'<key>SentryDSN</key><string>https://example.invalid</string>'}).length);
});
