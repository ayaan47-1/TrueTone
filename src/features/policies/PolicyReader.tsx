import { ScrollView, View } from 'react-native';
import { POLICY_BODIES } from '../../content/bodies';
import { POLICY_DOCS, type DocKey } from '../../content/manifest';
import { MistBackground, GlassSheet, Heading, Body, Eyebrow } from '../../components/ui';

const TITLES = Object.fromEntries(POLICY_DOCS.map((d) => [d.key, d.title])) as Record<DocKey, string>;

export function PolicyReader({ docKey, onClose }: { docKey: DocKey; onClose?: () => void }) {
  return (
    <MistBackground>
      <GlassSheet className="px-6 pt-6 pb-5 gap-3" onClose={onClose}>
        <View className="gap-1 pr-8">
          <Eyebrow>Policy</Eyebrow>
          <Heading>{TITLES[docKey] ?? 'Policy'}</Heading>
        </View>
        <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
          <Body className="text-ink-soft">{POLICY_BODIES[docKey]}</Body>
        </ScrollView>
      </GlassSheet>
    </MistBackground>
  );
}
