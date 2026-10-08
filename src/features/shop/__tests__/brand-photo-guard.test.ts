import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { HERO_PHOTOS } from '../../foryou/home-photos';
import { catalog } from '../../match/product-catalog';
import { KIT_PHOTOS, photoKey } from '../product-photos';
import { productPhoto } from '../product-visual';

const repoRoot = join(__dirname, '../../../..');
const forbiddenFilenames = ['p1.jpg', 'p3.jpg', 'p4.jpg', 'p8.jpg', 'hero_promo.jpg'] as const;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

test('only the four unbranded product photos remain available to product mappings', () => {
  expect(Object.keys(KIT_PHOTOS)).toEqual(['p2', 'p5', 'p6', 'p7']);
});

test.each(catalog.filter((product) => /concealer|tint/i.test(product.name)))(
  '$name falls back to drawn ProductArt',
  (product) => {
    expect(photoKey(product)).toBeUndefined();
    expect(productPhoto(product.id)).toBeUndefined();
  },
);

test('home slides expose no branded promo photo', () => {
  expect(Object.keys(HERO_PHOTOS)).toEqual(['scan', 'look']);
  expect(HERO_PHOTOS).not.toHaveProperty('promo');
});

test('forbidden brand-photo files are absent from the shipping asset tree', () => {
  const paths = [
    ...forbiddenFilenames.slice(0, 4).map((name) => join(repoRoot, 'assets/photos/products', name)),
    join(repoRoot, 'assets/photos/home', forbiddenFilenames[4]),
  ];
  expect(paths.filter(existsSync).map((path) => relative(repoRoot, path))).toEqual([]);
});

test('source and app code cannot require a forbidden brand-photo filename', () => {
  const requirePattern = new RegExp(
    String.raw`require\s*\([^)]*(?:${forbiddenFilenames.map((name) => name.replace('.', '\\.')).join('|')})[^)]*\)`,
    'i',
  );
  const matches = [join(repoRoot, 'src'), join(repoRoot, 'app')]
    .flatMap(sourceFiles)
    .filter((file) => requirePattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(repoRoot, file));

  expect(matches).toEqual([]);
});
