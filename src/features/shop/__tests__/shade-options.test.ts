// Shade picker options on the product page. Face products offer the product's own shade
// plus nearby depths in the same undertone; the user's derived depth is flagged as "your
// match". Other categories offer just their one shade.
import { catalog } from '../../match/product-catalog';
import type { MatchProfile, Product } from '../../match/match-types';
import { shadeOptions, defaultShadeIndex } from '../shade-options';

const byId = (id: string): Product => catalog.find((p) => p.id === id)!;
const PROFILE: MatchProfile = { shade: 6, undertone: 'warm', coverage: 'everyday', skips: [] };

test('a face product offers a range around its own shade, same undertone', () => {
  const opts = shadeOptions(byId('ver-velvet-10')); // Honey 5W
  expect(opts.map((o) => o.label)).toEqual(['Sand 3W', 'Beige 4W', 'Honey 5W', 'Golden 6W', 'Amber 7W']);
  opts.forEach((o) => expect(o.color).toMatch(/^hsl\(/));
});

test('the range is clamped to depths 1..10', () => {
  expect(shadeOptions(byId('sol-second-05')).map((o) => o.label)[0]).toBe('Porcelain 1N');
  expect(shadeOptions(byId('aur-comfort-14')).map((o) => o.label).slice(-1)[0]).toBe('Espresso 10C');
});

test("flags the user's derived depth as their match only after a scan", () => {
  expect(shadeOptions(byId('ver-velvet-10')).some((o) => o.isYourMatch)).toBe(false);
  const opts = shadeOptions(byId('ver-velvet-10'), PROFILE);
  expect(opts.filter((o) => o.isYourMatch).map((o) => o.label)).toEqual(['Golden 6W']);
});

test('a non-face product offers only its own shade', () => {
  expect(shadeOptions(byId('lum-lip-29')).map((o) => o.label)).toEqual(['Rosewood']);
});

test('defaults to your match, else the product shade', () => {
  const p = byId('ver-velvet-10');
  expect(shadeOptions(p)[defaultShadeIndex(shadeOptions(p))].label).toBe('Honey 5W');
  const scanned = shadeOptions(p, PROFILE);
  expect(scanned[defaultShadeIndex(scanned)].label).toBe('Golden 6W');
});

test('defaults to the product shade at the ends of the scale too', () => {
  const opts = shadeOptions(byId('sol-second-05')); // depth 1
  expect(opts[defaultShadeIndex(opts)].label).toBe('Porcelain 1N');
});
