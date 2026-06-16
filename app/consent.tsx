import { Consent } from '../src/features/consent/Consent';
import { useProfile } from '../src/lib/profile-context';

export default function ConsentRoute() {
  const { refresh } = useProfile();
  // onDecline leaves the camera locked: stay on this screen (no-op).
  return <Consent onConsent={refresh} onDecline={() => {}} />;
}
