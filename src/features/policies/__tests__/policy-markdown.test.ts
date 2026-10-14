import { parsePolicyMarkdown } from '../policy-markdown';

test('parses headings, paragraphs, blockquotes, and continued bullets', () => {
  expect(parsePolicyMarkdown('# Title\n\n## Section\n\nBody **bold**.\n\n> Note.\n\n- One\n  continued.')).toEqual([
    { kind: 'heading', level: 1, text: 'Title' },
    { kind: 'heading', level: 2, text: 'Section' },
    { kind: 'paragraph', text: 'Body **bold**.' },
    { kind: 'blockquote', text: 'Note.' },
    { kind: 'bullet', text: 'One continued.' },
  ]);
});

test('does not render counsel-pending source comments', () => {
  expect(parsePolicyMarkdown('<!-- Counsel-pending. -->\n\n# Policy')).toEqual([
    { kind: 'heading', level: 1, text: 'Policy' },
  ]);
});
