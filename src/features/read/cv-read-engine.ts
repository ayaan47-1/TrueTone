// Thin device wrapper that keeps the unchanged ReadEngine interface. The only device-only work
// (decode + still-image face detection) lives behind injectable deps; everything else is the
// pure, host-tested scoreFromRgb core. The raw image is always deleted via withImageCleanup —
// it never crosses the compliance boundary (CLAUDE.md §1, §3).
import * as FileSystem from 'expo-file-system';
import type { ReadEngine } from './read-engine';
import type { ReadResult } from './read-types';
import type { RgbImage } from './cv/types';
import { decodeJpegToRgb } from './decode-rgb';
import { detectFacesOnStill } from './detect-faces-still';
import { deriveRegionsForFace, type DetectedFace } from './face-geometry';
import { scoreFromRgb } from './cv/score-from-rgb';
import { withImageCleanup } from './image-lifecycle';

interface Deps {
  decode?: (uri: string) => Promise<RgbImage>;
  detect?: (uri: string) => Promise<DetectedFace | null>;
  cleanup?: (uri: string) => Promise<void>;
}

export class CvReadEngine implements ReadEngine {
  constructor(private readonly deps: Deps = {}) {}

  async run(uri: string): Promise<ReadResult> {
    const decode = this.deps.decode ?? decodeJpegToRgb;
    const detect = this.deps.detect ?? detectFacesOnStill;
    const cleanup = this.deps.cleanup
      ?? ((u: string) => FileSystem.deleteAsync(u, { idempotent: true }));
    return withImageCleanup(uri, async () => {
      const rgb = await decode(uri);
      // Detection is best-effort: a failure degrades region placement, it must never fail the read.
      let face: DetectedFace | null = null;
      try {
        face = await detect(uri);
      } catch {
        face = null;
      }
      const { regions } = deriveRegionsForFace(face, { width: rgb.width, height: rgb.height });
      return scoreFromRgb(rgb, regions);
    }, cleanup);
  }
}
