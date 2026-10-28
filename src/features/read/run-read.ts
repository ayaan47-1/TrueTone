// Capture-flow entry for the REAL read: run the CV engine on-device (which deletes the image),
// then persist only derived scores (CLAUDE.md §3). In __DEV__ (web/Expo Go preview, where the
// native decode is unavailable) it falls back to the stub so the non-device preview still works.
import type { ReadEngine } from './read-engine';
import type { ReadResult } from './read-types';
import { CvReadEngine } from './cv-read-engine';
import { stubRead } from './stub-read';
import { recordScan } from '../../lib/scans';
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
    if (__DEV__) {
      // Preview-only fallback: the device decode is unavailable off-device. Never reached on a
      // real Android dev build, where engine.run() returns a real cv-1 result.
      await persist(stubRead(), null);
      return;
    }
    throw err;
  }
}
