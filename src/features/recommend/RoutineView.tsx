import { View } from 'react-native';
import type { Routine, RoutineStep } from './routine-types';
import { Screen, GlassCard, Display, Subheading, Eyebrow, Body, Caption, PrimaryButton } from '../../components/ui';

function Step({ step }: { step: RoutineStep }) {
  return (
    <View className="mb-3 last:mb-0">
      <Body className="font-body-semibold text-ink">{step.category}</Body>
      <Caption className="text-[13px] text-ink-muted mt-0.5">{step.habit} — {step.rationale}</Caption>
    </View>
  );
}

export function RoutineView({ routine, onAsk }: { routine: Routine; onAsk?: () => void }) {
  return (
    <Screen className="px-6" contentStyle={{ paddingTop: 8, paddingBottom: 24 }}>
      <View className="gap-2 mb-5 mt-2">
        <Eyebrow>Brand-neutral, just for you</Eyebrow>
        <Display className="text-3xl">Your routine</Display>
      </View>

      <GlassCard radius={26} className="px-5 py-5 mb-4">
        <Subheading className="mb-3">Morning</Subheading>
        {routine.am.map((s, i) => <Step key={`am-${i}`} step={s} />)}
      </GlassCard>

      <GlassCard radius={26} className="px-5 py-5">
        <Subheading className="mb-3">Evening</Subheading>
        {routine.pm.map((s, i) => <Step key={`pm-${i}`} step={s} />)}
      </GlassCard>

      {routine.notes.map((n, i) => (
        <Body key={`note-${i}`} className="mt-4 px-1 font-display-italic text-ink-soft">{n}</Body>
      ))}

      {onAsk ? (
        <View className="mt-6">
          <PrimaryButton label="Ask about your routine" fullWidth onPress={onAsk} />
        </View>
      ) : null}

      <Caption className="mt-6 px-1 text-[11px]">
        This describes how your skin looks and suggests cosmetic habits — it is not medical advice.
      </Caption>
    </Screen>
  );
}
