// src/features/checkout/BagBar.tsx
// The Shop -> Checkout entry point. A compact glass bar that appears at the top of the
// Shop shelf ONLY once the bag has items; tapping it routes to the mock checkout screen.
// Presentation + navigation only.
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { GlassCard, Body, Caption, PressableScale } from '../../components/ui';
import { useBag, bagCount, bagSubtotal } from './bag-store';

export function BagBar() {
  const router = useRouter();
  const state = useBag();
  const count = bagCount(state);
  if (count === 0) return null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Review your bag and check out"
      onPress={() => router.push('/checkout')}
      testID="bag-bar"
    >
      <GlassCard className="flex-row items-center justify-between p-4">
        <View>
          <Body className="font-body-semibold text-ink">Your bag</Body>
          <Caption className="text-ink-soft">
            {count} item{count === 1 ? '' : 's'} · ${bagSubtotal(state)}
          </Caption>
        </View>
        <View className="rounded-full bg-brand-green px-4 py-2">
          <Caption className="text-white">Checkout</Caption>
        </View>
      </GlassCard>
    </PressableScale>
  );
}
