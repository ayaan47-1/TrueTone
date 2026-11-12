import { useEffect, useSyncExternalStore } from 'react';
import { Body, GlassCard, PrimaryButton } from '../../components/ui';
import { feedbackCleanup } from './runtime';

export function FeedbackCleanupNotice() {
  const pending = useSyncExternalStore(feedbackCleanup.subscribe, feedbackCleanup.getSnapshot, feedbackCleanup.getSnapshot);
  useEffect(() => { void feedbackCleanup.retry().catch(() => undefined); }, []);
  if (!pending) return null;
  return (
    <GlassCard className="my-3 px-5 py-4 gap-3">
      <Body accessibilityRole="alert">Some local shade feedback could not be cleared. Cleanup will retry automatically.</Body>
      <PrimaryButton label="Retry feedback cleanup" variant="ghost" onPress={() => { void feedbackCleanup.retry().catch(() => undefined); }} />
    </GlassCard>
  );
}
