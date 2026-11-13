import { useEffect, useRef } from 'react';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { Redirect, useRouter } from 'expo-router';
import { Capture } from '../../src/features/capture/Capture';
import { E2E_FIXTURE_IMAGE_BASE64_JPEG } from '../../src/features/capture/e2e-fixture-image';
import { runRead } from '../../src/features/read/run-read';
import { E2E_FIXTURE_SCAN } from '../../src/lib/e2e-fixture';
import { DEMO_MODE } from '../../src/lib/supabase';
import { useProfile } from '../../src/lib/profile-context';

export default function ScanRoute() {
  const router = useRouter();
  const { loading, error, route, userId } = useProfile();
  const gatesClear = !DEMO_MODE && !loading && !error && !!userId && route === 'home';

  // Real CV read: run the on-device engine on a captured photo, derive cosmetic scores, and
  // persist only the derived scan (image deleted on-device per CLAUDE.md §3). In __DEV__
  // (web/Expo Go preview, where native decode is unavailable), it falls back to stubRead() so
  // the non-device preview still works. Shared by the real <Capture> below and the
  // E2E_FIXTURE_SCAN substitution — both hand it a photo URI and nothing else changes.
  async function handleCaptured(photoUri: string) {
    try {
      await runRead(photoUri);
    } catch {
      // Even if the save fails, leave the camera — the result screen shows its empty/error state.
    }
    router.replace('/scan/result');
  }

  // E2E_FIXTURE_SCAN (HAG-231): __DEV__-and-flag-gated capture-step substitution for
  // environments with no camera hardware (CI / Simulator — CLAUDE.md §4). Writes the bundled
  // synthetic fixture (never a real photo, see e2e-fixture-image.ts) to disk and feeds it
  // through the EXACT SAME handleCaptured() the real camera would use — only the capture step
  // is replaced; the read/match/persist/no-egress pipeline is untouched. Only fires once the
  // same gates that would otherwise mount <Capture> are clear.
  const fired = useRef(false);
  useEffect(() => {
    if (!E2E_FIXTURE_SCAN || !gatesClear || fired.current) return;
    fired.current = true;
    void (async () => {
      const fixtureUri = `${cacheDirectory}e2e-fixture-scan.jpg`;
      await writeAsStringAsync(fixtureUri, E2E_FIXTURE_IMAGE_BASE64_JPEG, { encoding: 'base64' });
      await handleCaptured(fixtureUri);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleCaptured/router are stable per render cycle
  }, [gatesClear]);

  // The root navigation guard runs after mount. Never construct Capture before its
  // gates are known to be clear. DEMO_MODE still blocks even if CAMERA_DEMO is also set.
  if (DEMO_MODE) {
    return <Redirect href="/" />;
  }
  if (loading || error || !userId) return null;
  if (route !== 'home') return <Redirect href={route === 'consent' ? '/consent' : route === 'age-gate' ? '/age-gate' : '/region-blocked'} />;
  if (E2E_FIXTURE_SCAN) return null;

  return <Capture onCaptured={(photoUri) => handleCaptured(photoUri)} onCancel={() => router.back()} />;
}
