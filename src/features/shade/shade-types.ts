// src/features/shade/shade-types.ts
// Types for the derived makeup-shade result (plan B2). The derived shade itself is
// CurrentShade (owned by A's personalization store) — we reuse it rather than redefine.
//
// Compliance boundary (CLAUDE.md §3, plan Flag 4): the raw on-device read stays on the
// phone. Only the small bundle of derived descriptors below crosses into shade
// derivation — never the image, a URI, or bytes; and no raw read dimension is ever
// rendered as a number (the numbers here feed a pure mapping, they never reach the UI).
import type { SkinTypeFeel } from '../read/read-types';

/**
 * The raw scan-read descriptors deriveShade() consumes. Tone descriptors (lightness /
 * warmth / olive) place the foundation shade; skinType + oiliness pick a flattering
 * finish. All are DATA for a pure mapping — the integrator hands the on-device read's
 * derived values in here; nothing image-shaped is present.
 */
export interface ShadeReadInput {
  /** Overall lightness of the tone read, 0 (deepest) .. 1 (fairest). */
  readonly lightness: number;
  /** Warm↔cool undertone signal, -1 (cool) .. +1 (warm); |x| < 0.15 reads neutral. */
  readonly warmth: number;
  /** Olive / green cast, 0..1; dominates the undertone when high. */
  readonly olive: number;
  /** Derived skin-type feel from the read — informs a flattering finish. */
  readonly skinType: SkinTypeFeel;
  /** Oiliness score, 0..1, from the read — a higher value favours a matte finish. */
  readonly oiliness: number;
}

// Re-export the derived-shade shape so B2 consumers import it from one place.
export type { CurrentShade } from '../session/personalization';
