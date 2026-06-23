import { useRouter } from 'expo-router';
import { Capture } from '../../src/features/capture/Capture';
import { runRead } from '../../src/features/read/run-read';

export default function ScanRoute() {
  const router = useRouter();
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
