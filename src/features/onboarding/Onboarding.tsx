import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, GlassCard, Display, Body, Caption, Eyebrow, PrimaryButton } from '../../components/ui';

export function Onboarding() {
  const router = useRouter();
  return (
    <Screen scroll={false} className="px-6">
      <View className="flex-1 justify-center gap-8">
        <View className="gap-3">
          <Eyebrow>Skin, honestly</Eyebrow>
          <Display className="text-[44px]">TrueTone</Display>
          <Body className="text-base text-ink-soft">
            An honest, skin-tone-fair read of how your skin looks today.
          </Body>
        </View>

        <View className="gap-4">
          <PrimaryButton label="Start your read" fullWidth onPress={() => router.push('/scan')} />
        </View>
      </View>

      <GlassCard flat intensity={24} radius={26} className="px-5 py-4 mb-2">
        <Caption className="text-[11px] leading-[17px] text-ink-muted">
          TrueTone is a cosmetic and general-wellness tool. It is not a medical device, does not
          diagnose, treat, or prevent any disease or condition, and is not a substitute for
          professional medical advice. Results are AI-generated estimates of your skin&rsquo;s
          appearance. For any skin concern &mdash; or any new, changing, or unusual spot &mdash;
          please consult a board-certified dermatologist.
        </Caption>
      </GlassCard>
    </Screen>
  );
}
