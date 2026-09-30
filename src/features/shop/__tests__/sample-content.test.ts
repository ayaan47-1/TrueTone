// Sample/demo content for the v3 shop (Dwight's v3 demo-content ruling, 2026-09-29):
// ratings are sample-only and OFF by default; every label is the exact ruled wording.
import { catalog } from '../../match/product-catalog';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import {
  DEMO_PROMO_LABEL,
  DEMO_TOTALS_LABEL,
  SAMPLE_CATALOG_LABEL,
  SAMPLE_RATINGS_ENABLED,
  SAMPLE_RATINGS_LABEL,
  productSizes,
  sampleRating,
} from '../sample-content';

test('sample ratings are off by default', () => {
  expect(SAMPLE_RATINGS_ENABLED).toBe(false);
});

test('labels use the exact ruled wording', () => {
  expect(SAMPLE_CATALOG_LABEL).toBe('Sample catalog — products and images are for demonstration only.');
  expect(SAMPLE_RATINGS_LABEL).toBe('Sample data — not real ratings or reviews.');
  expect(DEMO_PROMO_LABEL).toBe('Demo promo — no purchases in this build.');
  expect(DEMO_TOTALS_LABEL).toBe('Demo checkout — sample pricing and shipping; no real orders.');
  [SAMPLE_CATALOG_LABEL, SAMPLE_RATINGS_LABEL, DEMO_PROMO_LABEL, DEMO_TOTALS_LABEL].forEach((l) => expect(findDiseaseTerms(l)).toEqual([]));
});

test('every product has a stable sample rating in 4.0..5.0 with a positive count', () => {
  catalog.forEach((p) => {
    const r = sampleRating(p.id);
    expect(r.rating).toBeGreaterThanOrEqual(4);
    expect(r.rating).toBeLessThanOrEqual(5);
    expect(Number.isInteger(r.reviews) && r.reviews > 0).toBe(true);
    expect(sampleRating(p.id)).toEqual(r);
  });
});

test('liquid face products and primers come in 30 ml / 50 ml; others have no sizes', () => {
  const byId = (id: string) => catalog.find((p) => p.id === id)!;
  expect(productSizes(byId('lum-satin-02'))).toEqual(['30 ml', '50 ml']);
  expect(productSizes(byId('ver-primer-27'))).toEqual(['30 ml', '50 ml']);
  expect(productSizes(byId('lum-bright-17'))).toEqual([]);
  expect(productSizes(byId('lum-lip-29'))).toEqual([]);
});
