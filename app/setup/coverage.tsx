import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Eyebrow, Heading, Body, PrimaryButton, PressableScale } from '../../src/components/ui';
import { COVERAGES, COVERAGE_LABELS, type Coverage } from '../../src/content/makeup-vocab';
import { preferencesStore } from '../../src/features/preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../../src/features/preferences/preferences-types';

/**
 * Setup 2 — coverage. Single-select of the everyday vibe the user wants. Persists as
 * a STRUCTURED field (no free text) via the preferences store; this feeds the
 * compatibility ranking. Pre-scan screen — no personalized strings here.
 */
export default function CoverageScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Coverage | null>(null);

  const onContinue = () => {
    if (selected === null) return;
    const existing = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;
    preferencesStore.set({ ...existing, coverage: selected });
    router.push('/scan'); // interim target; paywall/scan-gate land later in B1
  };

  return (
    <Screen className="px-6">
      <View className="flex-1 gap-8 pt-6">
        <View className="gap-3">
          <Eyebrow>Set up · 2 of 2</Eyebrow>
          <Heading>How much coverage?</Heading>
          <Body className="text-ink-soft">Pick the vibe you want most days — you can change it anytime.</Body>
        </View>

        <View className="flex-row flex-wrap gap-2.5">
          {COVERAGES.map((coverage) => {
            const on = selected === coverage;
            return (
              <PressableScale
                key={coverage}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setSelected(coverage)}
              >
                <View
                  className={
                    'rounded-full border px-4 py-2.5 ' +
                    (on ? 'bg-brand-green border-brand-green' : 'bg-transparent border-ink-faint')
                  }
                >
                  <Body className={on ? 'text-white' : 'text-ink-soft'}>{COVERAGE_LABELS[coverage]}</Body>
                </View>
              </PressableScale>
            );
          })}
        </View>

        <View className="mt-auto pb-2">
          <PrimaryButton label="Continue" onPress={onContinue} disabled={selected === null} />
        </View>
      </View>
    </Screen>
  );
}
