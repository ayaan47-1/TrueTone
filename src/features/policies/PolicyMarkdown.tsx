import { Fragment } from 'react';
import { Text, View } from 'react-native';
import { Body, Heading, Subheading } from '../../components/ui';
import { parsePolicyMarkdown } from './policy-markdown';

export function PolicyMarkdown({ markdown }: { markdown: string }) {
  return (
    <View className="gap-3 pb-4">
      {parsePolicyMarkdown(markdown).map((block, index) => {
        const key = `${block.kind}-${index}`;
        if (block.kind === 'heading') {
          return block.level === 1 ? (
            <Heading key={key}>{renderInline(block.text)}</Heading>
          ) : (
            <Subheading key={key} className="mt-2">{renderInline(block.text)}</Subheading>
          );
        }
        if (block.kind === 'blockquote') {
          return (
            <View key={key} className="rounded-2xl bg-white/45 px-4 py-3">
              <Body className="text-ink-muted">{renderInline(block.text)}</Body>
            </View>
          );
        }
        if (block.kind === 'bullet') {
          return <Body key={key} className="pl-2">• {renderInline(block.text)}</Body>;
        }
        return <Body key={key} className="text-ink-soft">{renderInline(block.text)}</Body>;
      })}
    </View>
  );
}

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*.+?\*\*|_.+?_)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={index} className="font-body-semibold text-ink">{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith('_') && part.endsWith('_')) {
      return <Text key={index} className="italic">{part.slice(1, -1)}</Text>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}
