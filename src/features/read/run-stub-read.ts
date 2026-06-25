// src/features/read/run-stub-read.ts
//
// Wires the DEV stub read into the capture flow with the same compliance shape as the real read:
// derive (placeholder) scores on-device, persist the derived scan, and delete the captured image
// afterward — even if persistence fails. Only derived scores cross the boundary; the image dies on
// device (CLAUDE.md §3). Replace with the real executorch engine (Task 4.2) when it lands.
import { deleteAsync } from 'expo-file-system/legacy';
import { recordScan } from '../../lib/scans';
import { estimateSkinAge } from '../age/skin-age-engine';
import { withImageCleanup } from './image-lifecycle';
import { stubRead } from './stub-read';

export async function runStubRead(photoUri: string): Promise<void> {
  await withImageCleanup(
    photoUri,
    async () => {
      const result = stubRead();
      const age = estimateSkinAge(result); // null while dark; computed before the image is deleted
      await recordScan(result, age);
    },
    (uri) => deleteAsync(uri, { idempotent: true }),
  );
}
