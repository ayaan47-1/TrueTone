export type PolicyBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph' | 'blockquote' | 'bullet'; text: string };

export function parsePolicyMarkdown(markdown: string): PolicyBlock[] {
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, '');
  return withoutComments
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block): PolicyBlock[] => {
      const heading = block.match(/^(#{1,3})\s+(.*)$/s);
      if (heading) {
        return [{ kind: 'heading', level: heading[1].length, text: heading[2].trim() }];
      }
      if (block.startsWith('>')) {
        return [{
          kind: 'blockquote',
          text: block.replace(/^>\s?/gm, '').replace(/\n/g, ' ').trim(),
        }];
      }
      if (/^[-*]\s+/.test(block)) {
        return block.split(/\n(?=[-*]\s+)/).map((item) => ({
          kind: 'bullet',
          text: item.replace(/^[-*]\s+/, '').replace(/\n\s+/g, ' ').trim(),
        }));
      }
      return [{ kind: 'paragraph', text: block.replace(/\n/g, ' ') }];
    });
}
