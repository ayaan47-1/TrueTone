// Capture-flow entry for the REAL read: run the CV engine on-device (which deletes the image),
// then persist only derived scores (CLAUDE.md §3). In __DEV__ (web/Expo Go preview, where the
// native decode is unavailable) it falls back to the stub so the non-device preview still works.
import type { ReadEngine } from './read-engine';
import type { ReadResult } from './read-types';
import { CvReadEngine } from './cv-read-engine';
import { stubRead } from './stub-read';
import { recordScan } from '../../lib/scans';
import { estimateSkinAge } from '../age/skin-age-engine';

interface Deps {
  engine?: ReadEngine;
  persist?: (r: ReadResult) => Promise<void>;
}

export async function runRead(photoUri: string, deps: Deps = {}): Promise<void> {
  const engine = deps.engine ?? new CvReadEngine();
  const persist = deps.persist ?? (async (result: ReadResult) => {
    await recordScan(result, estimateSkinAge(result));
  });
  try {
    const result = await engine.run(photoUri);
    await persist(result);
  } catch (err) {
    if (__DEV__) {
      // Preview-only fallback: the device decode is unavailable off-device. Never reached on a
      // real Android dev build, where engine.run() returns a real cv-1 result.
      await persist(stubRead());
      return;
    }
    throw err;
  }
}
