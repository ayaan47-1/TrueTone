import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Routine, RoutineStep } from './routine-types';
import { Screen, GlassCard, Display, Body, Caption } from '../../components/ui';
import { palette } from '../../theme/tokens';

const STEP_TINTS = ['#DCE6D7', '#EDDDCB', '#D9E5EC'] as const;

function Step({ step, index }: { step: RoutineStep; index: number }) {
  const [done, setDone] = useState(false);
  return (
    <GlassCard flat radius={22} className="px-4 py-4 flex-row items-center gap-4 mb-3">
      <View style={[styles.stepNumber, { backgroundColor: STEP_TINTS[index % STEP_TINTS.length] }]}>
        <Body className="text-[18px] text-ink-soft">{index + 1}</Body>
      </View>
      <View className="flex-1">
        {step.emphasized ? <Caption className="mb-0.5 text-[10px] uppercase tracking-wide">Focus today</Caption> : null}
        <Body className="font-semibold text-ink">{step.category}</Body>
        <Caption className="mt-0.5 text-[13px] text-ink-muted">{step.habit}</Caption>
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Mark ${step.category} done`}
        accessibilityState={{ checked: done }}
        onPress={() => setDone((value) => !value)}
        style={[styles.check, done && styles.checkDone]}
      >
        {done ? <View style={styles.tick} /> : null}
      </Pressable>
    </GlassCard>
  );
}

export function RoutineView({ routine, onAsk }: { routine: Routine; onAsk?: () => void }) {
  const [period, setPeriod] = useState<'am' | 'pm'>('am');
  const steps = period === 'am' ? routine.am : routine.pm;
  return (
    <Screen className="px-6" topGap={24} bottomGap={120}>
      <View className="mb-6 mt-2">
        <Display className="text-[30px]">Your routine</Display>
      </View>

      <View style={styles.segment}>
        {(['am', 'pm'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={value === 'am' ? 'Morning routine' : 'Evening routine'}
            accessibilityState={{ selected: period === value }}
            onPress={() => setPeriod(value)}
            style={[styles.segmentButton, period === value && styles.segmentButtonActive]}
          >
            <Body className={period === value ? 'font-semibold text-ink' : 'text-ink-muted'}>
              {value === 'am' ? 'Morning' : 'Evening'}
            </Body>
          </Pressable>
        ))}
      </View>

      <View className="mt-5">
        {steps.map((step, index) => <Step key={`${period}-${index}`} step={step} index={index} />)}
      </View>

      {routine.notes.map((n, i) => (
        <Body key={`note-${i}`} className="mt-4 px-1 font-display-italic text-ink-soft">{n}</Body>
      ))}

      {onAsk ? <Pressable accessibilityRole="button" onPress={onAsk} className="mt-5 self-center px-4 py-3"><Body className="font-semibold text-sage">Why these? →</Body></Pressable> : null}

      <Caption className="mt-6 px-1 text-[11px]">
        This describes how your skin looks and suggests cosmetic habits — it is not medical advice.
      </Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: palette.mist300 },
  segmentButton: { flex: 1, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segmentButtonActive: { backgroundColor: 'rgba(255,255,255,0.92)' },
  stepNumber: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#D8CFC0', alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: palette.sage, borderColor: palette.sage },
  tick: { width: 10, height: 6, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: palette.white, transform: [{ rotate: '-45deg' }], marginTop: -2 },
});
