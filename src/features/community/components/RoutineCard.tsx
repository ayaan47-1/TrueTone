// src/features/community/components/RoutineCard.tsx
// One Routines-tab card: creator header, title/summary, numbered steps, and a
// "Shop the look" trigger when the routine has tagged products.
import { View } from 'react-native';
import { Body, Caption, GlassCard, PressableScale, Subheading } from '../../../components/ui';
import { CreatorHeader } from './CreatorHeader';
import type { CommunityRoutine } from '../community-types';

interface RoutineCardProps {
  routine: CommunityRoutine;
  onShopTheLook: () => void;
}

export function RoutineCard({ routine, onShopTheLook }: RoutineCardProps) {
  return (
    <GlassCard flat radius={26} className="px-5 py-5 gap-3">
      <CreatorHeader creator={routine.creator} />
      <Subheading>{routine.title}</Subheading>
      <Body className="text-ink-muted">{routine.summary}</Body>
      <View className="gap-2 mt-1">
        {routine.steps.map((step, index) => (
          <View key={step.id} className="flex-row gap-3">
            <Caption className="text-ink-soft w-4">{index + 1}.</Caption>
            <View className="flex-1">
              <Body className="text-ink font-body-semibold">{step.title}</Body>
              <Caption className="text-ink-soft">{step.detail}</Caption>
            </View>
          </View>
        ))}
      </View>
      {routine.taggedProductIds.length > 0 ? (
        <PressableScale
          testID="shop-the-look"
          accessibilityRole="button"
          accessibilityLabel="Shop the look"
          onPress={onShopTheLook}
          className="mt-1"
        >
          <Caption className="text-sage font-body-semibold">Shop the look</Caption>
        </PressableScale>
      ) : null}
    </GlassCard>
  );
}
