import { useRouter } from 'expo-router';
import { AllergenSetup } from '../../src/features/allergens/AllergenSetup';
import { useProfile } from '../../src/lib/profile-context';

/**
 * Setup — optional allergen step (after Skips). Every answer (Yes-after-save, No, Skip)
 * continues to the existing paywall step; the paywall gates nothing about this feature.
 */
export default function AllergensSetupScreen() {
  const router = useRouter();
  const { userId } = useProfile();
  return (
    <AllergenSetup
      userId={userId}
      onDone={() => router.push('/paywall')}
      onOpenPolicy={() => router.push('/policies/wa_health')}
    />
  );
}
