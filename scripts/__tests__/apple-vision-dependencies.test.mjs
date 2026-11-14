import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAppleVision, forbiddenFaceDependencies } from '../check-apple-vision.mjs';

test('rejects native telemetry pods, including subspecs and capitalization', () => {
  for (const pod of ['GoogleMLKit/FaceDetection', 'MLKitFaceDetection', 'MLKitCommon', 'GoogleDataTransport', 'FirebaseAnalytics']) {
    assert.ok(forbiddenFaceDependencies(`PODS:\n - ${pod} (1.0)`).length, pod);
  }
});
test('rejects the RN wrapper even if iOS autolinking was disabled', () => {
  assert.ok(forbiddenFaceDependencies('react-native-vision-camera-face-detector').length);
});
test('permits Apple Vision and the camera transport, not a replacement telemetry SDK', () => {
  assert.deepEqual(forbiddenFaceDependencies('AppleVision\nVisionCamera\nNitroModules'), []);
});
test('shipped manifests no longer resolve the Google detector', () => {
  for (const file of ['package.json', 'package-lock.json']) {
    assert.deepEqual(forbiddenFaceDependencies(readFileSync(file, 'utf8')), [], file);
  }
});
test('native gate fails on missing pods, then checks the actual generated lockfile', () => {
  const root = mkdtempSync(join(tmpdir(), 'apple-vision-guard-'));
  try {
    assert.throws(() => checkAppleVision(root, true), /requires ios\/Podfile.lock/);
    mkdirSync(join(root, 'ios'));
    writeFileSync(join(root, 'ios/Podfile.lock'), 'PODS:\n  - GoogleDataTransport (10.0)');
    assert.throws(() => checkAppleVision(root, true), /GoogleDataTransport/);
    writeFileSync(join(root, 'ios/Podfile.lock'), 'PODS:\n  - TrueToneAppleVision (1.0)');
    assert.deepEqual(checkAppleVision(root, true), { nativeChecked: true });
  } finally { rmSync(root, { recursive: true }); }
});
