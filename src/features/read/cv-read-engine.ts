// Thin device wrapper that keeps the unchanged ReadEngine interface. The only device-only work
// (decode + still-image face detection) lives behind injectable deps; everything else is the
// pure, host-tested scoreFromRgb core. The raw image is always deleted via withImageCleanup —
// it never crosses the compliance boundary (CLAUDE.md §1, §3).
import * as FileSystem from 'expo-file-system';
import type { ReadEngine } from './read-engine';
import type { ReadResult } from './read-types';
import { decodeJpegToRgb, type DecodedImage } from './decode-rgb';
import { detectFacesOnStill } from './detect-faces-still';
import { deriveRegionsForFace, scaleFaceToWorkingSpace, type DetectedFace } from './face-geometry';
import { scoreFromRgb } from './cv/score-from-rgb';
import { withImageCleanup } from './image-lifecycle';

interface Deps {
  decode?: (uri: string) => Promise<DecodedImage>;
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
      const { rgb, sourceSize } = await decode(uri);
      // Detection is best-effort: a failure degrades region placement, it must never fail the read.
      let face: DetectedFace | null = null;
      try {
        face = await detect(uri);
      } catch {
        face = null;
      }
      // The detector reports bounds/contours in the SOURCE (full-resolution) image's pixel space,
      // but scoring runs against the downscaled working image — scale (and frame-consistency
      // guard) the detection into working-image space before deriving regions (task 16).
      const workingSize = { width: rgb.width, height: rgb.height };
      const scaledFace = scaleFaceToWorkingSpace(face, sourceSize, workingSize);
      const { regions } = deriveRegionsForFace(scaledFace, workingSize);
      return scoreFromRgb(rgb, regions);
    }, cleanup);
  }
}
