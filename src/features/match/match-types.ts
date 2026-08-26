// src/features/match/match-types.ts
// Shared shapes for the makeup shade-match boundary. Pure types — no runtime, no JSX.
// The ONLY number that leaves this boundary is a compatibility fit % (40..99); no raw
// skin-read dimension is ever represented here (CLAUDE.md §3, plan Flag 4).
import type {
  Coverage,
  Finish,
  ProductCategory,
  Skip,
  Undertone,
} from '../../content/makeup-vocab';

/** Depth of a shade on a 1 (fairest) .. 10 (deepest) scale. Foundation-tone DATA. */
export type ShadeDepth = number;

/**
 * A shopping product. Brand-neutral naming per CLAUDE.md §0 (we describe the product,
 * not a brand claim). `shade`/`undertone` are the tone this product is built for; the
 * scoring boundary compares them to the user's derived shade.
 */
export interface Product {
  readonly id: string;
  /** Brand-neutral, cosmetic-only display name. */
  readonly name: string;
  readonly category: ProductCategory;
  readonly finish: Finish;
  readonly hasShimmer: boolean;
  /** Target shade depth this product suits (1..10). */
  readonly shade: ShadeDepth;
  /** Target undertone this product suits. */
  readonly undertone: Undertone;
  /** Price in whole USD (display only; no payment logic here). */
  readonly price: number;
}

/**
 * The user's derived shade + the preference inputs the scoring boundary needs. This is
 * the ONLY user data that crosses into matching — never the raw image (CLAUDE.md §3).
 */
export interface MatchProfile {
  /** Derived shade depth, 1..10. */
  readonly shade: ShadeDepth;
  /** Derived undertone. */
  readonly undertone: Undertone;
  /** Chosen coverage (single). */
  readonly coverage: Coverage;
  /** Chosen skips (multi). */
  readonly skips: readonly Skip[];
}

/** A product paired with its computed fit and rank metadata. Immutable result shape. */
export interface ScoredProduct {
  readonly product: Product;
  /** Compatibility fit percentage, 40..99. The only score the UI may render. */
  readonly fit: number;
  /** Short, cosmetic-only reason the fit lands where it does. */
  readonly reason: string;
  /** True for the single top-ranked product within its filter view. */
  readonly isBestMatch: boolean;
}
