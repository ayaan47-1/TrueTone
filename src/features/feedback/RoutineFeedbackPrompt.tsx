// src/features/feedback/RoutineFeedbackPrompt.tsx
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { GlassCard, Body, PrimaryButton } from '../../components/ui';
import { setRoutineFeedback } from '../../lib/scans';
import type { RoutineHelpful } from './types';

const CHOICES: { value: RoutineHelpful; label: string }[] = [
  { value: 'helped', label: 'It helped' },
  { value: 'no_change', label: 'No change' },
  { value: 'worse', label: 'Looks worse' },
];

export function RoutineFeedbackPrompt({ scanId, onDone }: { scanId: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  // Ref guard blocks a synchronous double-tap (state updates are async, so `busy` alone has a stale
  // closure within the same tick); `busy` still drives the disabled visual.
  const inFlight = useRef(false);
  async function choose(value: RoutineHelpful) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await setRoutineFeedback(scanId, value);
      onDone?.();
    } catch {
      inFlight.current = false;
      setBusy(false); // let the user retry; never surface a diagnosis-shaped error
    }
  }
  return (
    <GlassCard flat radius={22} className="px-5 py-5">
      <Body className="mb-4 font-semibold text-ink">Did your routine help?</Body>
      <View className="gap-2">
        {CHOICES.map((c) => (
          <PrimaryButton
            key={c.value}
            label={c.label}
            variant={c.value === 'helped' ? 'primary' : 'ghost'}
            fullWidth
            disabled={busy}
            onPress={() => choose(c.value)}
          />
        ))}
      </View>
    </GlassCard>
  );
}
