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

  it('carries a shade name and a locally computed color swatch for every product', () => {
    for (const p of catalog) {
      expect(typeof p.shadeName).toBe('string');
      expect(p.shadeName && p.shadeName.length).toBeGreaterThan(0);
      expect(typeof p.color).toBe('string');
      expect(p.color && p.color.length).toBeGreaterThan(0);
      expect(p.color).toMatch(/^hsl\(/);
    }
  });

  it('keeps every user-facing name + shade name free of disease terms', () => {
    for (const p of catalog) {
      expect(findDiseaseTerms(p.name)).toEqual([]);
      expect(findDiseaseTerms(p.shadeName ?? '')).toEqual([]);
    }
  });

  it('ensures deep-shade swatches (9C, 9N, 10C, 10W) are pairwise distinct by a real margin', () => {
    const deepIds = ['aur-cover-24', 'ver-dewy-11', 'aur-comfort-14', 'mar-every-26']; // 9C, 9N, 10C, 10W
    const deepProducts = catalog.filter((p) => deepIds.includes(p.id));
    expect(deepProducts.length).toBe(4);

    const hslToRgb = (h, s, l) => {
      s /= 100;
      l /= 100;
      const k = n => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
    };

    const parseHsl = (colorStr) => {
      const match = colorStr.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
      if (!match) throw new Error(`Failed to parse HSL: ${colorStr}`);
      return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
    };

    const colors = deepProducts.map(p => {
      const [h, s, l] = parseHsl(p.color!);
      return hslToRgb(h, s, l);
    });

    const dist = (c1, c2) => Math.sqrt(Math.pow(c1[0]-c2[0], 2) + Math.pow(c1[1]-c2[1], 2) + Math.pow(c1[2]-c2[2], 2));

    // Check all pairwise combinations
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        expect(dist(colors[i], colors[j])).toBeGreaterThan(15);
      }
    }
  });
});
