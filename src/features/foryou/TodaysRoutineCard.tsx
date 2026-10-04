// src/features/foryou/TodaysRoutineCard.tsx
// "Today's routine" — the Home in-app widget (not an iOS home-screen widget). Summarises the
// user's own on-device AM/PM routine (the same data the Routine page edits) with an AM/PM
// toggle, and its button opens the Routine page. Product names only; no claims.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Caption, GlassCard, PressableScale, PrimaryButton } from '../../components/ui';
import { useProfile } from '../../lib/profile-context';
import { catalog } from '../match/product-catalog';
import { useDailyRoutine } from '../routine/use-daily-routine';
import type { DailyRoutine, RoutineSlot } from '../routine/routine-types';
import { SectionTitle } from './HomeV3Parts';

const SLOTS: readonly { key: RoutineSlot; label: string }[] = [
  { key: 'am', label: 'AM' },
  { key: 'pm', label: 'PM' },
];
const MAX_SHOWN = 3;
const TINTS = ['#DCE6D7', '#EDDDCB', '#D9E5EC'] as const;

function productName(id: string): string {
  return catalog.find((p) => p.id === id)?.name ?? id;
}

function summaryLine(routine: DailyRoutine): string {
  if (routine.am.length + routine.pm.length === 0) return 'No steps yet';
  return `${routine.am.length} morning · ${routine.pm.length} evening steps`;
}

/** Container: the signed-in user's routine, opening `/routine`. */
export function TodaysRoutineCard() {
  const router = useRouter();
  const { userId } = useProfile();
  const { today } = useDailyRoutine(userId);
  return <TodaysRoutineCardView routine={today} onOpen={() => router.push('/routine')} />;
}

export function TodaysRoutineCardView({ routine, onOpen }: { routine: DailyRoutine; onOpen: () => void }) {
  const [slot, setSlot] = useState<RoutineSlot>('am');
  const steps = routine[slot];
  const empty = routine.am.length + routine.pm.length === 0;

  return (
    <GlassCard radius={26} className="px-[18px] pb-[18px] pt-[18px]">
      <View className="flex-row items-center justify-between">
        <View>
          <SectionTitle>{"Today's routine"}</SectionTitle>
          <Caption>{summaryLine(routine)}</Caption>
        </View>
        {empty ? null : <SlotToggle slot={slot} onChange={setSlot} />}
      </View>
      {empty ? (
        <Caption className="mt-3">Add your morning and evening steps from your saved and bought products.</Caption>
      ) : (
        <View className="mt-2">
          {steps.length === 0 ? <Caption className="py-3">No {slot === 'am' ? 'morning' : 'evening'} steps</Caption> : null}
          {steps.slice(0, MAX_SHOWN).map((id, i) => (
            <View
              key={id}
              className="flex-row items-center gap-3.5 py-2.5"
              style={i ? { borderTopWidth: 1, borderTopColor: 'rgba(168,159,143,0.18)' } : undefined}
            >
              <View
                className="h-[34px] w-[34px] items-center justify-center rounded-xl"
                style={{ backgroundColor: TINTS[i % TINTS.length] }}
              >
                <Text className="font-body-bold text-[13px] text-ink-soft">{i + 1}</Text>
              </View>
              <Text className="flex-1 font-body-semibold text-[15px] text-ink">{productName(id)}</Text>
            </View>
          ))}
          {steps.length > MAX_SHOWN ? <Caption>{`+${steps.length - MAX_SHOWN} more`}</Caption> : null}
        </View>
      )}
      <View className="mt-3">
        <PrimaryButton label={empty ? 'Build your routine' : 'Open routine'} variant="glass" onPress={onOpen} />
      </View>
    </GlassCard>
  );
}

function SlotToggle({ slot, onChange }: { slot: RoutineSlot; onChange: (s: RoutineSlot) => void }) {
  return (
    <View className="flex-row rounded-full bg-mist-300 p-[3px]">
      {SLOTS.map(({ key, label }) => (
        <PressableScale
          key={key}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: slot === key }}
          onPress={() => onChange(key)}
          className={`rounded-full px-3.5 py-1.5 ${slot === key ? 'bg-white' : ''}`}
        >
          <Text className={`font-body-semibold text-[12px] ${slot === key ? 'text-ink' : 'text-ink-muted'}`}>{label}</Text>
        </PressableScale>
      ))}
    </View>
  );
}
