// src/features/recommend/ScanRoutineSuggestions.tsx
// Routine-page section: the brand-neutral AM/PM habits derived from the latest scan, shown as
// suggestions under the user's own routine. Cosmetic framing only; categories, never products.
import { View } from 'react-native';
import { Body, Caption, GlassCard, PressableScale, SectionLabel } from '../../components/ui';
import type { Routine, RoutineStep } from './routine-types';

function StepRow({ step }: { step: RoutineStep }) {
  return (
    <View className="mt-2">
      {step.emphasized ? <Caption className="text-[10px] uppercase tracking-wide">Focus today</Caption> : null}
      <Body className="text-ink">{step.category}</Body>
      <Caption className="text-ink-muted">{step.habit}</Caption>
    </View>
  );
}

export function ScanRoutineSuggestions({ routine, onAsk }: { routine: Routine; onAsk?: () => void }) {
  return (
    <GlassCard flat radius={22} className="px-5 py-4">
      <SectionLabel>Suggested from your last scan</SectionLabel>
      {routine.am.length > 0 ? <Caption className="mt-1 font-body-semibold">Morning</Caption> : null}
      {routine.am.map((s, i) => <StepRow key={`am-${i}`} step={s} />)}
      {routine.pm.length > 0 ? <Caption className="mt-3 font-body-semibold">Evening</Caption> : null}
      {routine.pm.map((s, i) => <StepRow key={`pm-${i}`} step={s} />)}
      {routine.notes.map((n, i) => (
        <Body key={`note-${i}`} className="mt-3 font-display-italic text-ink-soft">{n}</Body>
      ))}
      {onAsk ? (
        <PressableScale accessibilityRole="button" onPress={onAsk} className="mt-3 self-start py-2">
          <Body className="font-semibold text-sage">Why these? →</Body>
        </PressableScale>
      ) : null}
    </GlassCard>
  );
}
