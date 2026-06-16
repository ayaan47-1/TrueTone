import { ScrollView, Text } from 'react-native';
import { POLICY_BODIES } from '../../content/bodies';
import type { DocKey } from '../../content/manifest';

export function PolicyReader({ docKey }: { docKey: DocKey }) {
  return (
    <ScrollView className="flex-1 p-6">
      <Text>{POLICY_BODIES[docKey]}</Text>
    </ScrollView>
  );
}
