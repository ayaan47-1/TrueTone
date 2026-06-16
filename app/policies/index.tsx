import { useRouter } from 'expo-router';
import { PolicyList } from '../../src/features/policies/PolicyList';
import type { DocKey } from '../../src/content/manifest';

export default function PoliciesScreen() {
  const router = useRouter();
  return <PolicyList onOpen={(k: DocKey) => router.push(`/policies/${k}`)} />;
}
