import { readFileSync, existsSync } from 'node:fs';

// Any ad/analytics/attribution SDK that could touch face/skin/score/health data is
// forbidden on the data path (CLAUDE.md §1; the GoodRx/BetterHelp/Flo trap).
const FORBIDDEN = [
  '@react-native-firebase/analytics',
  'firebase/analytics',
  'react-native-fbsdk',
  'react-native-fbsdk-next',
  'expo-facebook',
  '@segment/',
  'react-native-google-mobile-ads',
  'react-native-appsflyer',
  'amplitude',
  'mixpanel',
  'react-native-branch',
];

export function findForbidden(text) {
  return FORBIDDEN.filter((f) => text.includes(f));
}

function scan() {
  // Scan declared deps, the resolved lockfile (transitive), and Expo plugin config.
  const files = ['package.json', 'package-lock.json', 'app.json', 'app.config.js', 'app.config.ts'];
  const blob = files
    .filter(existsSync)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  const hits = findForbidden(blob);
  if (hits.length) {
    console.error('FORBIDDEN analytics/ad SDK detected:', hits);
    process.exit(1);
  }
  console.log('compliance: no forbidden analytics/ad SDKs found');
}

if (import.meta.url === `file://${process.argv[1]}`) scan();
