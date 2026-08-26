import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Eyebrow, Heading, Body, PrimaryButton, PressableScale } from '../../src/components/ui';
import { SKIPS, SKIP_LABELS, type Skip } from '../../src/content/makeup-vocab';
import { toggleSkip } from '../../src/features/setup-ui/skip-selection';
import { preferencesStore } from '../../src/features/preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../../src/features/preferences/preferences-types';

/**
 * Setup — skips. Optional multi-select of product attributes the user would rather
 * avoid. Persists as STRUCTURED fields (no free text) via the preferences store.
 * Continue is always enabled (skips are optional). Pre-scan screen — no personalized
 * strings here; cosmetic shade/makeup language only.
 */
export default function SkipsScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<readonly Skip[]>([]);

  const onContinue = () => {
    const existing = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;
    preferencesStore.set({ ...existing, skips: [...selected] });
    router.push('/paywall');
  };

  return (
    <Screen className="px-6">
      <View className="flex-1 gap-8 pt-6">
        <View className="gap-3">
          <Eyebrow>One more thing</Eyebrow>
          <Heading>Anything you'd rather skip?</Heading>
          <Body className="text-ink-soft">Optional — we'll steer matches away from these.</Body>
        </View>

        <View className="flex-row flex-wrap gap-2.5">
          {SKIPS.map((skip) => {
            const on = selected.includes(skip);
            return (
              <PressableScale
                key={skip}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setSelected((prev) => toggleSkip(prev, skip))}
              >
                <View
                  className={
                    'rounded-full border px-4 py-2.5 ' +
                    (on ? 'bg-brand-green border-brand-green' : 'bg-transparent border-ink-faint')
                  }
                >
                  <Body className={on ? 'text-white' : 'text-ink-soft'}>{SKIP_LABELS[skip]}</Body>
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
