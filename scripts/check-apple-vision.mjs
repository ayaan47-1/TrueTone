import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const forbidden = [
  /react-native-vision-camera-face-detector/ig,
  /GoogleMLKit(?:\/[\w-]+)?/ig, /MLKit[\w/-]*/ig,
  /GoogleDataTransport/ig, /FirebaseAnalytics/ig, /Firebase\/Analytics/ig,
];
export function forbiddenFaceDependencies(text) {
  return [...new Set(forbidden.flatMap(pattern => [...text.matchAll(pattern)].map(m => m[0])))];
}
export function checkAppleVision(root, requireNative = false) {
  const files = ['package.json', 'package-lock.json', 'app.json', 'app.config.js', 'react-native.config.js', 'ios/Podfile.lock'];
  const native = join(root, 'ios/Podfile.lock');
  if (requireNative && !existsSync(native)) throw Error('Generate iOS pods first; the native dependency guard requires ios/Podfile.lock');
  const failures = files.filter(f => existsSync(join(root, f))).flatMap(file => {
    const hits = forbiddenFaceDependencies(readFileSync(join(root, file), 'utf8'));
    return hits.length ? [{ file, hits }] : [];
  });
  // Check native package declarations too, not only direct app dependencies.
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.build', 'build', '.swiftpm'].includes(entry.name)) continue;
      const file = join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(?:podspec|swift|mm|m|h)$/.test(file)) {
        const hits = forbiddenFaceDependencies(readFileSync(file, 'utf8'));
        if (hits.length) failures.push({ file, hits });
      }
    }
  }
  walk(join(root, 'packages'));
  if (failures.length) throw Error('Forbidden iOS face dependency: ' + JSON.stringify(failures));
  return { nativeChecked: existsSync(native) };
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log('Apple Vision dependency guard:', checkAppleVision(process.cwd(), process.argv.includes('--native'))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
