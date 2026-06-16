import { View, Text, Pressable } from 'react-native';
import { POLICY_DOCS, type DocKey } from '../../content/manifest';

export function PolicyList({ onOpen }: { onOpen: (k: DocKey) => void }) {
  return (
    <View className="flex-1 p-6 gap-2">
      {POLICY_DOCS.map((d) => (
        <Pressable key={d.key} onPress={() => onOpen(d.key)} className="border rounded p-3">
          <Text>{d.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}
