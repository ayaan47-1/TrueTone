// src/features/foryou/TodaysRoutineCard.tsx
// "Today's routine" (kit RoutineCard3): an AM/PM toggle, a progress bar and three
// checkable steps. Runs on SAMPLE steps (home-sample-data.ts) — ticks are local to this
// card and not saved. The kit's "4-day streak" is left out: it would state a fact about
// the user that we do not track.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Caption, GlassCard, PressableScale } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { CheckGlyph } from '../shop/shop-icons';
import { SectionTitle } from './HomeV3Parts';
import { SAMPLE_ROUTINE, SAMPLE_ROUTINE_DONE, type RoutineSlot } from './home-sample-data';

const SLOTS: readonly RoutineSlot[] = ['AM', 'PM'];

export function TodaysRoutineCard() {
  const [slot, setSlot] = useState<RoutineSlot>('AM');
  const [done, setDone] = useState<Readonly<Record<string, boolean>>>(SAMPLE_ROUTINE_DONE);
  const steps = SAMPLE_ROUTINE[slot];
  const count = steps.filter((_, i) => done[`${slot}${i}`]).length;
  const toggle = (key: string): void => setDone((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <GlassCard radius={26} className="px-[18px] pb-2 pt-[18px]">
      <View className="flex-row items-center justify-between">
        <View>
          <SectionTitle>{"Today's routine"}</SectionTitle>
          <Caption>{`${count} of ${steps.length} done`}</Caption>
        </View>
        <SlotToggle slot={slot} onChange={setSlot} />
      </View>
      <View className="mb-1 mt-3.5 h-1 overflow-hidden rounded-full bg-mist-300">
        <View className="h-full rounded-full bg-sage" style={{ width: `${(count / steps.length) * 100}%` }} />
      </View>
      {steps.map((step, i) => {
        const key = `${slot}${i}`;
        const on = Boolean(done[key]);
        return (
          <PressableScale
            key={key}
            accessibilityRole="checkbox"
            accessibilityLabel={step.title}
            accessibilityState={{ checked: on }}
            onPress={() => toggle(key)}
            className="flex-row items-center gap-3.5 py-3"
            style={i ? { borderTopWidth: 1, borderTopColor: 'rgba(168,159,143,0.18)' } : undefined}
          >
            <View
              className="h-[38px] w-[38px] items-center justify-center rounded-xl"
              style={{ backgroundColor: step.tone }}
            >
              <Text className="font-body-bold text-[13px] text-ink-soft">{i + 1}</Text>
            </View>
            <View className="flex-1">
              <Text
                className={`font-body-semibold text-[15px] ${on ? 'text-ink-muted line-through' : 'text-ink'}`}
              >
                {step.title}
              </Text>
              <Caption>{step.detail}</Caption>
            </View>
            <View
              className="h-[26px] w-[26px] items-center justify-center rounded-full"
              style={on ? { backgroundColor: palette.sage } : { borderWidth: 2, borderColor: palette.inkFaint }}
            >
              {on ? <CheckGlyph color={palette.white} size={11} /> : null}
            </View>
          </PressableScale>
        );
      })}
    </GlassCard>
  );
}

function SlotToggle({ slot, onChange }: { slot: RoutineSlot; onChange: (s: RoutineSlot) => void }) {
  return (
    <View className="flex-row rounded-full bg-mist-300 p-[3px]">
      {SLOTS.map((s) => (
        <PressableScale
          key={s}
          accessibilityRole="button"
          accessibilityLabel={s}
          accessibilityState={{ selected: slot === s }}
          onPress={() => onChange(s)}
          className={`rounded-full px-3.5 py-1.5 ${slot === s ? 'bg-white' : ''}`}
        >
          <Text className={`font-body-semibold text-[12px] ${slot === s ? 'text-ink' : 'text-ink-muted'}`}>{s}</Text>
        </PressableScale>
      ))}
    </View>
  );
}
