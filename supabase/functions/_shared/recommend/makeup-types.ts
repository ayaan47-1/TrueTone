// SOURCE OF TRUTH: src/features/session/personalization.ts (CurrentShade) +
// src/features/preferences/preferences-types.ts (SetupAnswers) — kept in sync manually.
// The Deno edge runtime cannot import those React-bound modules, so the shapes are mirrored here.
import type { Undertone, Finish, Goal, Coverage, Skip } from './makeup-vocab.ts';

export interface CurrentShade {
  shadeName: string;
  undertone: Undertone;
  depth: number;
  finish: Finish;
}

export interface SetupAnswers {
  goals: readonly Goal[];
  coverage: Coverage;
  skips: readonly Skip[];
}
