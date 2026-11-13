// Capture-flow entry for the REAL read: run the CV engine on-device (which deletes the image),
// then persist only derived scores (CLAUDE.md §3). In __DEV__ (web/Expo Go preview, where the
// native decode is unavailable) it falls back to the stub so the non-device preview still works.
import type { ReadEngine } from './read-engine';
import type { ReadResult } from './read-types';
import { CvReadEngine } from './cv-read-engine';
import { stubRead } from './stub-read';
import { recordScan } from '../../lib/scans';
import { E2E_FORCE_PERSIST_FAILURE } from '../../lib/e2e-force-persist-failure';
import { E2E_FIXTURE_SCAN } from '../../lib/e2e-fixture';
import { estimateSkinAge } from '../age/skin-age-engine';
import { personalization, type CurrentShade } from '../session/personalization';
import { deriveShade, deriveToneFromLab } from '../shade/derive-shade';

interface Deps {
  engine?: ReadEngine;
  persist?: (r: ReadResult, shade: CurrentShade | null) => Promise<void>;
}

export async function runRead(
  photoUri: string,
  deps: Deps = {},
  captureQuality: 'good' | 'fair' | 'poor' | null = null,
): Promise<void> {
  const engine = deps.engine ?? new CvReadEngine();
  const persist = deps.persist ?? (async (result: ReadResult, shade: CurrentShade | null) => {
    // HAG-231, Toby review finding 1: E2E-only seam so a test can force this step to fail
    // deterministically -- see src/lib/e2e-force-persist-failure.ts. __DEV__-gated there, so
    // this branch is dead code in any release build regardless of the env var.
    if (E2E_FORCE_PERSIST_FAILURE) {
      throw new Error('E2E_FORCE_PERSIST_FAILURE: simulated persistence failure (HAG-231)');
    }
    await recordScan(result, estimateSkinAge(result), captureQuality, { shade });
  });
  try {
    const result = await engine.run(photoUri);
    // Live camera shade-match seam (Phase 1, tt-cam-integrate): derive the makeup shade from the
    // FRESH in-memory tone read and publish it via personalization.setScan() -- the result screen
    // renders off currentShade and the For You rail re-ranks off it. tone survives only in-memory
    // here (it does NOT round-trip through persistence), so map it now. Descriptors only; the image
    // is already deleted on-device (CLAUDE.md §3). Stub/no-CV reads have no tone -> no shade set.
    // The same shade's LABELS are saved to the user's shade history (words only, no tone numbers).
    const shade = result.tone
      ? deriveShade({
          ...deriveToneFromLab(result.tone),
          skinType: result.skinType,
          oiliness: result.scores.oiliness,
        })
      : null;
    if (shade) personalization.setScan(shade);
    await persist(result, shade);
  } catch (err) {
    // HAG-231, Dwight review fix (c): under the E2E fixture flag, a failure must fail loudly,
    // never silently substitute stubRead() -- that silent substitution is exactly what let a
    // broken fixture image pass undetected. __DEV__-gated in e2e-fixture.ts, so this condition
    // is always false in any release build regardless of the env var.
    if (__DEV__ && !E2E_FIXTURE_SCAN) {
      // Preview-only fallback: the device decode is unavailable off-device. Never reached on a
      // real Android dev build, where engine.run() returns a real cv-1 result.
      await persist(stubRead(), null);
      return;
    }
    throw err;
  }
}
