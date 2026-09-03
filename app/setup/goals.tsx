import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, HEADER_CLEARANCE, Eyebrow, Heading, Body, PrimaryButton, PressableScale } from '../../src/components/ui';
import { GOALS, GOAL_LABELS, type Goal } from '../../src/content/makeup-vocab';
import { toggleGoal } from '../../src/features/setup-ui/goal-selection';
import { preferencesStore } from '../../src/features/preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../../src/features/preferences/preferences-types';

/**
 * Setup 1 — goals. Multi-select of the looks the user is going for. Persists as
 * STRUCTURED fields (no free text) via the preferences store; these feed the
 * compatibility ranking. Pre-scan screen — no personalized strings here.
 */
export default function GoalsScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<readonly Goal[]>([]);

  const onContinue = () => {
    const existing = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;
    preferencesStore.set({ ...existing, goals: [...selected] });
    router.push('/setup/coverage');
  };

  return (
    <Screen className="px-6" topGap={HEADER_CLEARANCE}>
      <View className="flex-1 gap-8 pt-6">
        <View className="gap-3">
          <Eyebrow>Set up · 1 of 2</Eyebrow>
          <Heading>What are you going for?</Heading>
          <Body className="text-ink-soft">Pick as many as you like — it shapes what we match you to.</Body>
        </View>

        <View className="flex-row flex-wrap gap-2.5">
          {GOALS.map((goal) => {
            const on = selected.includes(goal);
            return (
              <PressableScale
                key={goal}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setSelected((prev) => toggleGoal(prev, goal))}
              >
                <View
                  className={
                    'rounded-full border px-4 py-2.5 ' +
                    (on ? 'bg-brand-green border-brand-green' : 'bg-transparent border-ink-faint')
                  }
                >
                  <Body className={on ? 'text-white' : 'text-ink-soft'}>{GOAL_LABELS[goal]}</Body>
                </View>
              </PressableScale>
            );
          })}
        </View>

        <View className="mt-auto pb-2">
          <PrimaryButton label="Continue" onPress={onContinue} />
        </View>
      </View>
    </Screen>
  );
}
