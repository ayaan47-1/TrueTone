import { execSync } from 'node:child_process';

test('no image files are tracked under eval/ (raw faces never enter git)', () => {
  const tracked = execSync('git ls-files eval', { encoding: 'utf8' });
  const images = tracked.split('\n').filter((f) => /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(f));
  expect(images).toEqual([]);
});

test('eval/data is gitignored', () => {
  const out = execSync('git check-ignore eval/data/sample.jpg || true', { encoding: 'utf8' });
  expect(out).toContain('eval/data/sample.jpg');
});
