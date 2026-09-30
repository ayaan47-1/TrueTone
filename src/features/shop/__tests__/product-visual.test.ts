// Pure helpers behind the product art (v3 ProductArt3 port): bundled local AI photos per
// product, with the drawn shape + tone kept as the fallback.
import { catalog } from '../../match/product-catalog';
import type { Product } from '../../match/match-types';
import { productShape, productTone, productLine, productPhoto } from '../product-visual';
import { KIT_PHOTOS, photoKey } from '../product-photos';

const byId = (id: string): Product => {
  const p = catalog.find((c) => c.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe('productShape', () => {
  test.each([
    ['lum-tint-01', 'pump'], // skin tint
    ['lum-satin-02', 'dropper'], // foundation
    ['lum-bright-17', 'tube'], // concealer
    ['ver-primer-27', 'jar'], // prep
    ['lum-lip-29', 'stick'], // lips
    ['sol-eye-30', 'compact'], // eyes
  ])('%s draws as a %s', (id, shape) => {
    expect(productShape(byId(id))).toBe(shape);
  });

  test('every catalog product maps to a known shape', () => {
    const shapes = ['dropper', 'pump', 'tube', 'jar', 'stick', 'compact'];
    catalog.forEach((p) => expect(shapes).toContain(productShape(p)));
  });
});

describe('productTone', () => {
  test('uses the product swatch colour as the product colour (skin-tone data, not brand)', () => {
    const p = byId('ver-dewy-11');
    expect(productTone(p).product).toBe(p.color);
  });

  test('falls back to a warm neutral when a product has no swatch', () => {
    const { color: _c, ...rest } = byId('lum-tint-01');
    expect(productTone(rest as Product).product).toMatch(/^#/);
  });

  test('gives each category a pale backdrop', () => {
    expect(productTone(byId('lum-lip-29')).backdrop).not.toBe(productTone(byId('ver-primer-27')).backdrop);
  });
});

describe('productLine', () => {
  test('splits the brand-neutral line name off the product title', () => {
    expect(productLine(byId('lum-tint-01'))).toEqual({ line: 'Lumira', title: 'Weightless Skin Tint' });
  });

  test('keeps a one-word name whole', () => {
    expect(productLine({ ...byId('lum-tint-01'), name: 'Primer' })).toEqual({ line: '', title: 'Primer' });
  });
});

describe('productPhoto', () => {
  test('every catalog product has a bundled local AI photo (founder ruling 2026-09-29)', () => {
    catalog.forEach((p) => expect(productPhoto(p.id)).toBeDefined());
  });

  test.each([
    ['lum-tint-01', 'p1'], // skin tint → white bottles
    ['lum-satin-02', 'p2'], // foundation → amber dropper
    ['lum-bright-17', 'p8'], // concealer → tube
    ['ver-primer-27', 'p7'], // prep → jar
    ['lum-lip-29', 'p5'], // lips → balm
    ['sol-eye-30', 'p6'], // eyes → palette
  ])('%s shows the kit photo %s', (id, key) => {
    expect(photoKey(byId(id))).toBe(key);
    expect(productPhoto(id)).toBe(KIT_PHOTOS[key as keyof typeof KIT_PHOTOS]);
  });

  test('an unknown id has no photo, so the drawn art stays the fallback', () => {
    expect(productPhoto('not-a-product')).toBeUndefined();
  });

  test('returns a licensed local photo when one is registered for that product', () => {
    const src = 42; // what require('./x.jpg') resolves to under Metro
    expect(productPhoto('lum-tint-01', { 'lum-tint-01': src })).toBe(src);
  });
});
