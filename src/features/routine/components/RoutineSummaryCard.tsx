// src/features/routine/components/RoutineSummaryCard.tsx
// Compact For You widget: today's AM/PM count and the current streak. Purely presentational --
// it takes a RoutineSummary and an optional press handler (the container sources the data).
import { View } from 'react-native';
import { GlassCard, PressableScale, Caption, Subheading, Body } from '../../../components/ui';
import type { RoutineSummary } from '../routine-types';

interface RoutineSummaryCardProps {
  summary: RoutineSummary;
  onPress?: () => void;
}

function streakLabel(streak: number): string {
  if (streak <= 0) return 'Start your streak today';
  return `${streak}-day streak`;
}

function todayLabel(summary: RoutineSummary): string {
  if (summary.todayCount === 0) return 'Nothing logged yet today';
  return `${summary.amCount} AM · ${summary.pmCount} PM logged today`;
}

export function RoutineSummaryCard({ summary, onPress }: RoutineSummaryCardProps) {
  return (
    <PressableScale
      testID="routine-summary"
      accessibilityRole="button"
      accessibilityLabel="My daily routine"
      accessibilityHint="Opens routine logging in Account"
      onPress={onPress}
      disabled={!onPress}
    >
      <GlassCard flat radius={22} className="px-5 py-4 flex-row items-center justify-between">
        <View className="flex-1 gap-0.5">
          <Caption className="text-ink-muted">My daily routine</Caption>
          <Subheading className="text-[17px]">{streakLabel(summary.streak)}</Subheading>
          <Caption className="text-ink-soft">{todayLabel(summary)}</Caption>
        </View>
        <View className="items-center justify-center h-12 w-12 rounded-2xl bg-mist-300 ml-3">
          <Body className="font-semibold text-ink">{summary.todayCount}</Body>
        </View>
      </GlassCard>
    </PressableScale>
  );
}
