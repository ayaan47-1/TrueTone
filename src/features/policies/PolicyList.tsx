import { View, Text, Pressable } from 'react-native';
import { POLICY_DOCS, type DocKey } from '../../content/manifest';
import { Screen, GlassCard, Display, Eyebrow, Body } from '../../components/ui';

export function PolicyList({ onOpen }: { onOpen: (k: DocKey) => void }) {
  return (
    <Screen className="px-6" contentStyle={{ paddingTop: 8 }}>
      <View className="gap-2 mb-6 mt-2">
        <Eyebrow>The fine print, plainly</Eyebrow>
        <Display className="text-3xl">Policies</Display>
      </View>
      <View className="gap-3">
        {POLICY_DOCS.map((d) => (
          <Pressable key={d.key} onPress={() => onOpen(d.key)} accessibilityRole="button">
            {({ pressed }) => (
              <GlassCard
                flat
                intensity={28}
                radius={22}
                className="px-5 py-4 flex-row items-center justify-between"
                style={{ opacity: pressed ? 0.7 : 1 }}
              >
                <Body className="font-body-medium text-ink flex-1 pr-3">{d.title}</Body>
                <Text className="font-body text-mauve-500 text-lg">›</Text>
              </GlassCard>
            )}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
