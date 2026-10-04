// The Community like control is a heart only -- never a thumbs-up (founder request).
import * as fs from 'fs';
import * as path from 'path';
import { render, fireEvent } from '@testing-library/react-native';
import { CommunityScreen } from '../CommunityScreen';
import { HeartGlyph } from '../community-icons';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

test('HeartGlyph draws an outline heart, and a filled heart when liked', async () => {
  const outline = await render(<HeartGlyph color="#000" />);
  expect(outline.getByTestId('heart-glyph').props.children).toBe('♡︎');

  const filled = await render(<HeartGlyph color="#000" filled />);
  expect(filled.getByTestId('heart-glyph').props.children).toBe('♥︎');
});

test('the like button shows a heart and speaks as a heart', async () => {
  const view = await render(<CommunityScreen />);
  const like = view.getAllByTestId('engagement-like')[0];
  expect(like.props.accessibilityLabel).toBe('Like');
  expect(like.props.accessibilityHint).toBe('Adds a heart to this post');
  expect(view.getAllByTestId('heart-glyph').length).toBeGreaterThan(0);

  await fireEvent.press(like);
  const liked = view.getAllByTestId('engagement-like')[0];
  expect(liked.props.accessibilityLabel).toBe('Unlike');
  expect(liked.props.accessibilityHint).toBe('Removes your heart from this post');
});

test('no thumbs-up icon, copy or naming anywhere in Community', () => {
  const root = path.join(__dirname, '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full); }
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  walk(root);
  files.push(path.join(root, '../../../app/(tabs)/community.tsx'));
  for (const file of files) {
    expect([file, /thumbs?[-_ ]?up|\u{1F44D}/iu.test(fs.readFileSync(file, 'utf8'))]).toEqual([file, false]);
  }
});
