import { useLocalSearchParams, useRouter } from 'expo-router';
import { PolicyReader } from '../../src/features/policies/PolicyReader';
import type { DocKey } from '../../src/content/manifest';

export default function PolicyReaderScreen() {
  const { doc } = useLocalSearchParams<{ doc: DocKey }>();
  const router = useRouter();
  return <PolicyReader docKey={doc} onClose={() => router.back()} />;
}
