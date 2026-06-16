import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findForbidden } from '../check-no-analytics-sdk.mjs';

test('flags forbidden SDKs anywhere in dependency text', () => {
  const hits = findForbidden('{"dependencies":{"@react-native-firebase/analytics":"1.0.0"}}');
  assert.ok(hits.includes('@react-native-firebase/analytics'));
});

test('clean manifest yields no hits', () => {
  assert.equal(findForbidden('{"dependencies":{"expo-router":"1.0.0"}}').length, 0);
});
