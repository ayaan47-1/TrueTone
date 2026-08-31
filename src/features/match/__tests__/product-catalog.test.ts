// src/features/match/__tests__/product-catalog.test.ts
// The synthetic demo catalog: enough realistic foundations + concealers, across several
// brand-neutral lines and undertones, to make the Shop shelf feel populated on a device
// build with no backend. Pure data checks + a compliance sweep over every user-facing
// string (product name + shade name) against the disease blocklist (CLAUDE.md §1).
import { catalog } from '../product-catalog';
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';
import {
  FINISHES,
  PRODUCT_CATEGORIES,
  UNDERTONES,
  type Finish,
  type ProductCategory,
  type Undertone,
} from '../../../content/makeup-vocab';

const isFoundation = (name: string) => /foundation|skin tint/i.test(name);
const isConcealer = (name: string) => /concealer/i.test(name);

describe('synthetic product catalog', () => {
  it('is populated enough to fill the Shop shelf (24..40 products)', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(24);
    expect(catalog.length).toBeLessThanOrEqual(40);
  });

  it('leads with foundations and concealers', () => {
    const foundations = catalog.filter((p) => isFoundation(p.name));
    const concealers = catalog.filter((p) => isConcealer(p.name));
    expect(foundations.length).toBeGreaterThanOrEqual(14);
    expect(concealers.length).toBeGreaterThanOrEqual(8);
  });

  it('gives every product a unique id', () => {
    const ids = catalog.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only valid enum values and a 1..10 shade depth with a positive price', () => {
    for (const p of catalog) {
      expect(PRODUCT_CATEGORIES).toContain(p.category as ProductCategory);
      expect(FINISHES).toContain(p.finish as Finish);
      expect(UNDERTONES).toContain(p.undertone as Undertone);
      expect(p.shade).toBeGreaterThanOrEqual(1);
      expect(p.shade).toBeLessThanOrEqual(10);
      expect(p.price).toBeGreaterThan(0);
    }
  });

  it('covers the warm/neutral/cool undertones and a fair-to-deep depth range', () => {
    const undertones = new Set(catalog.map((p) => p.undertone));
    expect(undertones.has('warm')).toBe(true);
    expect(undertones.has('neutral')).toBe(true);
    expect(undertones.has('cool')).toBe(true);
    const depths = catalog.map((p) => p.shade);
    expect(Math.min(...depths)).toBeLessThanOrEqual(2);
    expect(Math.max(...depths)).toBeGreaterThanOrEqual(9);
  });

  it('carries a shade name and a placeholder image for every product', () => {
    for (const p of catalog) {
      expect(typeof p.shadeName).toBe('string');
      expect(p.shadeName && p.shadeName.length).toBeGreaterThan(0);
      expect(typeof p.image).toBe('string');
      expect(p.image && p.image.length).toBeGreaterThan(0);
    }
  });

  it('keeps every user-facing name + shade name free of disease terms', () => {
    for (const p of catalog) {
      expect(findDiseaseTerms(p.name)).toEqual([]);
      expect(findDiseaseTerms(p.shadeName ?? '')).toEqual([]);
    }
  });
});
