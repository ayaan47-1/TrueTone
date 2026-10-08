import { Consent } from '../src/features/consent/Consent';
import { useProfile } from '../src/lib/profile-context';
import { useRouter } from 'expo-router';

export default function ConsentRoute() {
  const { refresh } = useProfile();
  const router = useRouter();
  // onDecline leaves the camera locked: stay on this screen (no-op).
  return (
    <Consent
      onConsent={refresh}
      onDecline={() => {}}
      onOpenPolicy={(docKey) => router.push(`/policies/${docKey}`)}
    />
  );
}
