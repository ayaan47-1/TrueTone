// src/features/read/read-engine.ts
// The read-engine contract. Pure interface (no native dependency) so callers and the
// pure decode/lifecycle logic typecheck on a workstation; the concrete implementation
// (executorch-engine.ts) is the device-only shell.
import type { ReadResult } from './read-types';

export interface ReadEngine {
  /**
   * Runs the on-device read for a captured photo (a local file uri) and returns derived
   * cosmetic scores. The implementation MUST delete the raw image after the read (success OR
   * failure) — the image never crosses the compliance boundary (CLAUDE.md §1, §3).
   */
  run(uri: string): Promise<ReadResult>;
}
