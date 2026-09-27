import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AllergenEditor } from '../src/features/allergens/AllergenEditor';
import { useProfile } from '../src/lib/profile-context';

function confirm(msg: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Confirm', msg, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirm', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/** Account → Ingredient flags. Reached from the Account tab. */
export default function AllergensScreen() {
  const router = useRouter();
  const { userId } = useProfile();
  return (
    <AllergenEditor
      userId={userId}
      confirm={confirm}
      onOpenPolicy={() => router.push('/policies/wa_health')}
    />
  );
}
