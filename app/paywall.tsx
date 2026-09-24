import { useState } from 'react';
import { View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  HEADER_CLEARANCE,
  Eyebrow,
  Heading,
  Body,
  Caption,
  PrimaryButton,
  PressableScale,
  GlassCard,
} from '../src/components/ui';
import {
  purchasePlan,
  restorePurchases,
  type SubscriptionPlan,
} from '../src/features/premium/entitlement';

/**
 * TrueTone Plus paywall — integration-ready subscription entitlement.
 * Connects to the pluggable EntitlementSource (StoreKit / RevenueCat / local test stub).
 * Pre-scan screen — cosmetic copy only, no personalized strings, no medical/condition language.
 */
export default function PaywallScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState<SubscriptionPlan>('yearly');
  const [loading, setLoading] = useState(false);

  const goNext = () => router.push('/scan-gate');

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await purchasePlan(plan);
      if (res.success) {
        goNext();
      } else if (!res.userCancelled) {
        Alert.alert('Subscription error', res.error || 'Failed to complete subscription');
      }
    } catch (e) {
      Alert.alert('Subscription error', e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const res = await restorePurchases();
      if (res.success && res.entitlement?.isPlusSubscriber) {
        Alert.alert('Subscription restored', 'Your TrueTone Plus subscription has been restored.', [
          { text: 'Continue', onPress: goNext },
        ]);
      } else {
        Alert.alert('No subscription found', 'No active TrueTone Plus subscription was found to restore.');
      }
    } catch (e) {
      Alert.alert('Restore error', e instanceof Error ? e.message : 'Unable to restore purchases');
    } finally {
      setLoading(false);
    }
  };

  const ctaLabel = loading
    ? 'Processing...'
    : plan === 'yearly'
    ? 'Start free trial'
    : 'Subscribe for $8.99/mo';

  return (
    <Screen className="px-6" topGap={HEADER_CLEARANCE} bottomGap={24}>
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
            testID="plan-yearly"
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
            testID="plan-monthly"
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
          <PrimaryButton
            label={ctaLabel}
            onPress={handleSubscribe}
            testID="paywall-subscribe"
          />

          <View className="flex-row justify-between items-center px-2 py-1">
            <PressableScale
              accessibilityRole="button"
              onPress={handleRestore}
              testID="paywall-restore"
            >
              <Caption className="text-ink-faint underline">Restore purchases</Caption>
            </PressableScale>

            <PressableScale
              accessibilityRole="button"
              onPress={goNext}
              testID="paywall-maybe-later"
            >
              <Caption className="text-ink-faint">Maybe later</Caption>
            </PressableScale>
          </View>

          <Caption className="text-center text-ink-faint text-xs">
            Recurring subscription. Cancel anytime in App Store settings at least 24h before renewal.
          </Caption>
        </View>
      </View>
    </Screen>
  );
}
