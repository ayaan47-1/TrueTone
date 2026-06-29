import { ScrollView, View, useWindowDimensions } from 'react-native';
import { POLICY_BODIES } from '../../content/bodies';
import { POLICY_DOCS, type DocKey } from '../../content/manifest';
import { MistBackground, GlassSheet, Heading, Body, Eyebrow } from '../../components/ui';
import { SHORT_VIEWPORT_THRESHOLD } from '../../components/ui/use-responsive';

const TITLES = Object.fromEntries(POLICY_DOCS.map((d) => [d.key, d.title])) as Record<DocKey, string>;

export function PolicyReader({ docKey, onClose }: { docKey: DocKey; onClose?: () => void }) {
  const { height } = useWindowDimensions();
  // Keep the original 440 cap on normal-height phones; only relax it (to ~58% of the
  // viewport) on short folded screens where 440 would clip below the fold.
  const maxHeight =
    height > 0 && height < SHORT_VIEWPORT_THRESHOLD ? Math.max(220, Math.round(height * 0.58)) : 440;
  return (
    <MistBackground>
      <GlassSheet className="px-6 pt-6 pb-5 gap-3" onClose={onClose}>
        <View className="gap-1 pr-8">
          <Eyebrow>Policy</Eyebrow>
          <Heading>{TITLES[docKey] ?? 'Policy'}</Heading>
        </View>
        <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>
          <Body className="text-ink-soft">{POLICY_BODIES[docKey]}</Body>
        </ScrollView>
      </GlassSheet>
    </MistBackground>
  );
}
