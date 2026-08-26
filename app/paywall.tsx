import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Eyebrow, Heading, Body, PrimaryButton, PressableScale, GlassCard } from '../src/components/ui';

type Plan = 'yearly' | 'monthly';

/**
 * TrueTone Plus paywall — a PRICING SHELL only. No StoreKit, no real purchase:
 * both the CTA and "Maybe later" simply route on to the scan gate. Two selectable
 * plan cards drive local state. Pre-scan screen — cosmetic copy only, no personalized
 * strings, no medical/condition language.
 */
export default function PaywallScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>('yearly');

  const goNext = () => router.push('/scan-gate');

  return (
    <Screen className="px-6">
      <View className="flex-1 gap-8 pt-6">
        <View className="gap-3">
          <Eyebrow>TrueTone Plus</Eyebrow>
          <Heading>Unlock your best matches</Heading>
          <Body className="text-ink-soft">
            Get every shade match, unlimited scans, and your full routine — all in one place.
          </Body>
        </View>

        <View className="gap-3.5">
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ selected: plan === 'yearly' }}
            onPress={() => setPlan('yearly')}
          >
            <GlassCard
              className={
                'gap-1.5 px-5 py-4 border ' +
                (plan === 'yearly' ? 'border-brand-green' : 'border-ink-faint')
              }
            >
              <View className="flex-row items-center gap-2.5">
                <Heading>Yearly</Heading>
                <View className="rounded-full bg-brand-green px-2.5 py-1">
                  <Body className="text-white">Best value</Body>
                </View>
              </View>
              <Body className="text-ink-soft">$39.99/yr</Body>
              <Body className="text-ink-faint">7-day free trial</Body>
            </GlassCard>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ selected: plan === 'monthly' }}
            onPress={() => setPlan('monthly')}
          >
            <GlassCard
              className={
                'gap-1.5 px-5 py-4 border ' +
                (plan === 'monthly' ? 'border-brand-green' : 'border-ink-faint')
              }
            >
              <Heading>Monthly</Heading>
              <Body className="text-ink-soft">$8.99/mo</Body>
            </GlassCard>
          </PressableScale>
        </View>

        <View className="mt-auto gap-3 pb-2">
          <PrimaryButton label="Start free trial" onPress={goNext} />
          <PressableScale accessibilityRole="button" onPress={goNext}>
            <View className="items-center py-2">
              <Body className="text-ink-faint">Maybe later</Body>
            </View>
          </PressableScale>
        </View>
      </View>
    </Screen>
  );
}
