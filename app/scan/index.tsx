import { Redirect, useRouter } from 'expo-router';
import { Capture } from '../../src/features/capture/Capture';
import { runRead } from '../../src/features/read/run-read';
import { DEMO_MODE } from '../../src/lib/supabase';

export default function ScanRoute() {
  const router = useRouter();

  // Render-level guarantee, not effect-level (app/_layout.tsx's Guard redirects away from
  // /scan too, but only after an effect fires post-mount). DEMO_MODE stubs an
  // already-onboarded identity with no age-gate/consent in front of it, so <Capture> must
  // be structurally impossible to reach this render tree -- returning the redirect here,
  // synchronously, means the camera component is never constructed regardless of effect
  // timing or how many devices race to mount this screen.
  if (DEMO_MODE) {
    return <Redirect href="/" />;
  }

  return (
    <Capture
      // Real CV read: run the on-device engine on a captured photo, derive cosmetic scores,
      // and persist only the derived scan (image deleted on-device per CLAUDE.md §3). In __DEV__
      // (web/Expo Go preview, where native decode is unavailable), it falls back to stubRead()
      // so the non-device preview still works. Real Android dev builds always get the real read.
      onCaptured={async (photoUri) => {
        try {
          await runRead(photoUri);
        } catch {
          // Even if the save fails, leave the camera — the result screen shows its empty/error state.
        }
        router.replace('/scan/result');
      }}
      onCancel={() => router.back()}
    />
  );
}
