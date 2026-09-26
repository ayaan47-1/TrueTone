// src/features/routine/components/RoutineSummaryWidget.tsx
// For You container for the routine summary: sources the signed-in userId and the daily-routine
// summary, then renders the presentational card. Tapping it opens the Account tab where logging
// lives. Kept as a thin container so the card stays pure/testable.
import { useRouter } from 'expo-router';
import { useProfile } from '../../../lib/profile-context';
import { useDailyRoutine } from '../use-daily-routine';
import { RoutineSummaryCard } from './RoutineSummaryCard';

export function RoutineSummaryWidget() {
  const router = useRouter();
  const { userId } = useProfile();
  const { summary } = useDailyRoutine(userId);
  return <RoutineSummaryCard summary={summary} onPress={() => router.push('/you')} />;
}
