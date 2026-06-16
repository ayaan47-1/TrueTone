import { Alert } from 'react-native';
import { DataRights } from '../../src/features/data-rights/DataRights';
import { useProfile } from '../../src/lib/profile-context';

function confirm(msg: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Confirm', msg, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirm', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function DataScreen() {
  const { refresh } = useProfile();
  return <DataRights onChanged={() => void refresh()} confirm={confirm} />;
}
