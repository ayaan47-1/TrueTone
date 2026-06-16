import { View, Text } from 'react-native';
import { AgeGate } from '../src/features/age-gate/AgeGate';
import { useProfile } from '../src/lib/profile-context';

export default function AgeGateRoute() {
  const { userId, refresh } = useProfile();
  // Fail closed: without a bootstrapped identity we cannot record the 18+ flag.
  if (!userId) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>Preparing…</Text>
      </View>
    );
  }
  return <AgeGate userId={userId} onPass={refresh} />;
}
