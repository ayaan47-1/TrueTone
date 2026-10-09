import fs from 'node:fs';
import path from 'node:path';

describe('commerce privacy boundary', () => {
  it('does not import sensitive feature state or tracking libraries', () => {
    const root = path.resolve(__dirname, '..');
    const sources = fs
      .readdirSync(root)
      .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
      .map((name) => fs.readFileSync(path.join(root, name), 'utf8'))
      .join('\n');

    expect(sources).not.toMatch(/features\/(scan|read|routine|chat|session|profile)/);
    expect(sources).not.toMatch(/firebase|segment|amplitude|mixpanel|pixel|analytics\.track/i);
    expect(sources).not.toMatch(/ScoreVector|rawImage|imageUri|scanId|userId/);
  });
});
