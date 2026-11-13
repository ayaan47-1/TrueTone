// MASVS M5: no audio or overlay permission may come back through a plugin default.
// Runs Expo's own config introspection (plugins + mods applied, no prebuild written) and checks the
// Info.plist and AndroidManifest that a build would get.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = join(import.meta.dirname, '../..');
const require = createRequire(join(ROOT, 'package.json'));
const cli = require.resolve('expo/bin/cli');
const config = JSON.parse(
  execFileSync(process.execPath, [cli, 'config', '--type', 'introspect', '--json'], { cwd: ROOT, encoding: 'utf8' }),
);
const plist = config._internal.modResults.ios.infoPlist;
const perms = config._internal.modResults.android.manifest.manifest['uses-permission'] ?? [];
const granted = perms.filter((p) => p.$['tools:node'] !== 'remove').map((p) => p.$['android:name']);
const removed = perms.filter((p) => p.$['tools:node'] === 'remove').map((p) => p.$['android:name']);

test('iOS declares no microphone purpose string', () => {
  assert.equal(plist.NSMicrophoneUsageDescription, undefined);
});

test('iOS keeps the approved camera and photo-library purpose strings', () => {
  assert.match(plist.NSCameraUsageDescription, /^TrueTone uses the front camera only/);
  assert.match(plist.NSPhotoLibraryUsageDescription, /^TrueTone uses your photo library/);
});

for (const name of ['android.permission.RECORD_AUDIO', 'android.permission.SYSTEM_ALERT_WINDOW']) {
  test(`Android does not request ${name} and blocks it from any library manifest`, () => {
    assert.ok(!granted.includes(name), `${name} is requested`);
    assert.ok(removed.includes(name), `${name} is not blocked`);
  });
}

test('Android still requests CAMERA for the shade scan', () => {
  assert.ok(granted.includes('android.permission.CAMERA'));
});
