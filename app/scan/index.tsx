import { useRouter } from 'expo-router';
import { Capture } from '../../src/features/capture/Capture';
import { runStubRead } from '../../src/features/read/run-stub-read';

export default function ScanRoute() {
  const router = useRouter();
  return (
    <Capture
      // DEV STUB read (the real executorch engine, Task 4.2, isn't built yet): derive placeholder
      // cosmetic scores on-device, persist the scan, and delete the image. Only derived scores cross
      // the compliance boundary; the image is never uploaded (CLAUDE.md §3). The scan is marked
      // isStub:true so it's never mistaken for a real read.
      onCaptured={async (photoUri) => {
        try {
          await runStubRead(photoUri);
        } catch {
          // Even if the save fails, leave the camera — the result screen shows its empty/error state.
        }
        router.replace('/scan/result');
      }}
      onCancel={() => router.back()}
    />
  );
}
