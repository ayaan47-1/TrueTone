import { View } from 'react-native';
import { AgeGate } from '../src/features/age-gate/AgeGate';
import { useProfile } from '../src/lib/profile-context';
import { MistBackground, GlassCard, Body } from '../src/components/ui';

export default function AgeGateRoute() {
  const { userId, refresh } = useProfile();
  // Fail closed: without a bootstrapped identity we cannot record the 18+ flag.
  if (!userId) {
    return (
      <MistBackground>
        <View className="flex-1 items-center justify-center px-8">
          <GlassCard className="px-7 py-8 items-center" radius={32}>
            <Body>Preparing…</Body>
          </GlassCard>
        </View>
      </MistBackground>
    );
  }
  return <AgeGate userId={userId} onPass={refresh} />;
}
