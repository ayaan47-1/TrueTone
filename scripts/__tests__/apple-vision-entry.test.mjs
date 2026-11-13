import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('production Vision entry points cannot accept an injected request performer', () => {
  const engine = readFileSync('packages/apple-vision/ios/VisionEngine.swift', 'utf8');
  const production = engine.replace(/#if APPLE_VISION_TESTING[\s\S]*?#endif/g, '');
  assert.doesNotMatch(production, /static func detect(?:Still)?\([^\{]*perform:/);
  assert.match(engine, /#if APPLE_VISION_TESTING\s+static func detectForTesting/);
  const bridge = readFileSync('packages/apple-vision/ios/HybridAppleVisionDetector.swift', 'utf8');
  assert.doesNotMatch(bridge, /ForTesting|perform:/);
  const pod = readFileSync('packages/apple-vision/TrueToneAppleVision.podspec', 'utf8');
  assert.doesNotMatch(pod, /APPLE_VISION_(?:HOST_)?TESTING|Tests\//);
});

test('production Swift compiler excludes the observation injection API', { skip: process.platform !== 'darwin' }, () => {
  const directory = mkdtempSync(join(tmpdir(), 'vision-production-'));
  try {
    const sources = ['VisionGeometry.swift', 'VisionEngine.swift'].map(name =>
      resolve('packages/apple-vision/ios', name));
    const args = ['-typecheck', '-module-cache-path', join(directory, 'cache'), ...sources];
    const production = spawnSync('swiftc', args, { encoding: 'utf8' });
    assert.equal(production.status, 0, production.stderr);
    const probe = join(directory, 'Probe.swift');
    writeFileSync(probe, 'func probe() throws { _ = try VisionEngine.detectStillForTesting(uri: "file:///blank.jpg") { _, _ in [] } }');
    const injected = spawnSync('swiftc', [...args, probe], { encoding: 'utf8' });
    assert.notEqual(injected.status, 0);
    assert.match(injected.stderr, /has no member 'detectStillForTesting'/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
