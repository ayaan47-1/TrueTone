// Pure helpers behind the CSS-drawn product art (v3 ProductArt3 port). No photos ship:
// the art is shape + tone, and a licensed photo can be swapped in per product later.
import { catalog } from '../../match/product-catalog';
import type { Product } from '../../match/match-types';
import { productShape, productTone, productLine, productPhoto } from '../product-visual';

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
  test('ships no photos by default (licence unknown) so the drawn art is used', () => {
    catalog.forEach((p) => expect(productPhoto(p.id)).toBeUndefined());
  });

  test('returns a licensed local photo when one is registered for that product', () => {
    const src = 42; // what require('./x.jpg') resolves to under Metro
    expect(productPhoto('lum-tint-01', { 'lum-tint-01': src })).toBe(src);
  });
});
