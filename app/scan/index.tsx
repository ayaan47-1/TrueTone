import { useRouter } from 'expo-router';
import { Capture } from '../../src/features/capture/Capture';

export default function ScanRoute() {
  const router = useRouter();
  return (
    <Capture
      // The on-device read (Task 4.2) will consume this URI, derive cosmetic scores, then delete
      // the image — only the derived scores cross the compliance boundary (CLAUDE.md §3). Until the
      // read engine is wired, we route straight to the results view. The image is never uploaded.
      onCaptured={() => router.replace('/scan/result')}
      onCancel={() => router.back()}
    />
  );
}
