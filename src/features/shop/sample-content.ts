// src/features/shop/sample-content.ts
// Sample/demo content for the v3 shop, per Dwight's v3 demo-content ruling (2026-09-29,
// hive research/truetone-design/v3-demo-content-ruling.md). The catalog is SAMPLE data:
//  - the Shop shows SAMPLE_CATALOG_LABEL once;
//  - star ratings + review counts are fabricated, so they render ONLY when
//    SAMPLE_RATINGS_ENABLED is true (internal TestFlight at most — never App Store or
//    external TestFlight), and always with SAMPLE_RATINGS_LABEL beside each one.
import type { Product } from '../match/match-types';

/** Fabricated ratings are shown only when this is true. Keep false for any external build. */
export const SAMPLE_RATINGS_ENABLED = false;
/**
 * Seeded like/save counts on Community posts are fabricated engagement (FTC 16 CFR 465), so they
 * show only while this is true: internal TestFlight at most. Set false for any external build;
 * the icons stay, the numbers go.
 */
export const SAMPLE_ENGAGEMENT_ENABLED = true;

export const SAMPLE_CATALOG_LABEL = 'Sample catalog — products and images are for demonstration only.';
export const SAMPLE_RATINGS_LABEL = 'Sample data — not real ratings or reviews.';
export const SAMPLE_COMMUNITY_LABEL = 'Sample community — demo creators and posts, not real users.';

export interface SampleRating {
  readonly rating: number;
  readonly reviews: number;
}

/** Stable small hash of an id (sample data must not change between renders). */
function hash(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 100_003;
  return h;
}

/** A deterministic SAMPLE rating for a product — never real consumer data. */
export function sampleRating(id: string): SampleRating {
  const h = hash(id);
  return { rating: (44 + (h % 6)) / 10, reviews: 120 + (h % 1180) };
}

const SIZED = /tint|foundation|primer/i;

/** Size options (kit: liquid bases + primers come in 30 ml / 50 ml). */
export function productSizes(product: Product): readonly string[] {
  return SIZED.test(product.name) ? ['30 ml', '50 ml'] : [];
}
