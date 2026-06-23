// Thin device wrapper that keeps the unchanged ReadEngine interface. The only device-only work
// (decode + still-image bbox detection) lives behind injectable deps; everything else is the
// pure, host-tested scoreFromRgb core. The raw image is always deleted via withImageCleanup —
// it never crosses the compliance boundary (CLAUDE.md §1, §3).
import * as FileSystem from 'expo-file-system';
import type { Rect } from './cv/types';
import type { RgbImage } from './cv/types';
import type { ReadEngine } from './read-engine';
import type { ReadResult } from './read-types';
import { withImageCleanup } from './image-lifecycle';
import { scoreFromRgb } from './cv/score-from-rgb';
import { decodeJpegToRgb } from './decode-rgb';
import { detectFaceBbox } from './detect-bbox';

interface Deps {
  decode?: (uri: string) => Promise<RgbImage>;
  detect?: (rgb: RgbImage) => Promise<Rect>;
  del?: (uri: string) => Promise<void>;
}

export class CvReadEngine implements ReadEngine {
  private readonly decode: (uri: string) => Promise<RgbImage>;
  private readonly detect: (rgb: RgbImage) => Promise<Rect>;
  private readonly del: (uri: string) => Promise<void>;

  constructor(deps: Deps = {}) {
    this.decode = deps.decode ?? decodeJpegToRgb;
    this.detect = deps.detect ?? detectFaceBbox;
    this.del = deps.del ?? ((uri: string) => FileSystem.deleteAsync(uri, { idempotent: true }));
  }

  async run(uri: string): Promise<ReadResult> {
    return withImageCleanup(
      uri,
      async (u) => {
        const rgb = await this.decode(u); // DEVICE: native JPEG decode
        const bbox = await this.detect(rgb); // bbox in the decoded image's pixel space
        return scoreFromRgb(rgb, bbox); // pure, tested
      },
      this.del,
    );
  }
}
