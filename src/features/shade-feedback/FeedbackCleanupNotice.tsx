import { useEffect, useSyncExternalStore } from 'react';
import { Body, GlassCard, Heading, PrimaryButton } from '../../components/ui';
import { feedbackCleanup } from './runtime';

export function FeedbackCleanupNotice({state,onRetry}:{state?:'checking'|'blocked';onRetry?:()=>void}={}) {
  const pending = useSyncExternalStore(feedbackCleanup.subscribe, feedbackCleanup.getSnapshot, feedbackCleanup.getSnapshot);
  useEffect(() => { if (state===undefined) void feedbackCleanup.retry().catch(() => undefined); }, [state]);
  if (!state && !pending) return null;
  if (state==='checking') return <GlassCard testID="feedback-access-card" className="my-3 px-5 py-4 gap-3">
    <Heading>Checking feedback access…</Heading>
    <Body>Confirming consent and local cleanup.</Body>
  </GlassCard>;
  return (
    <GlassCard testID="feedback-access-card" className="my-3 px-5 py-4 gap-3">
      <Body accessibilityRole="alert">{state==='blocked'?'Feedback is paused until consent and local cleanup can be confirmed.':'Some local shade feedback could not be cleared. Cleanup will retry automatically.'}</Body>
      <PrimaryButton label={onRetry?'Try again':'Retry feedback cleanup'} variant="ghost" onPress={onRetry??(() => { void feedbackCleanup.retry().catch(() => undefined); })} />
    </GlassCard>
  );
}
