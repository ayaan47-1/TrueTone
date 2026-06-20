import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, GlassCard, Display, Body, Caption, Eyebrow, PrimaryButton } from '../../components/ui';
import { fitzpatrick } from '../../theme/tokens';

/**
 * Inclusive Fitzpatrick I–VI tone strip — a decorative, non-interactive motif on
 * the welcome screen. Colours come from the `fitzpatrick` token (tokens.ts /
 * tailwind), never hardcoded here. The caption names the dermatological scale
 * factually; it is NOT a fairness/equity performance claim (those are gated on
 * validation data per CLAUDE.md §1/§6).
 */
function ToneStrip() {
  return (
    <GlassCard flat intensity={28} radius={22} className="px-4 py-3.5 gap-2.5">
      <View style={styles.swatchRow} accessibilityElementsHidden importantForAccessibility="no">
        {fitzpatrick.map((c, i) => (
          <View
            key={c}
            style={[
              styles.swatch,
              { backgroundColor: c },
              i === 0 && styles.swatchFirst,
              i === fitzpatrick.length - 1 && styles.swatchLast,
            ]}
          />
        ))}
      </View>
      <Caption className="text-[10px] uppercase tracking-[1.4px] text-ink-muted">
        Fitzpatrick I–VI
      </Caption>
    </GlassCard>
  );
}

export function Onboarding() {
  const router = useRouter();
  return (
    <Screen scroll={false} className="px-6">
      <View className="flex-1 justify-center gap-9">
        <View className="gap-3.5">
          <Eyebrow>Skin, honestly</Eyebrow>
          <Display className="text-[52px]">TrueTone</Display>
          <Body className="text-base text-ink-soft max-w-[260px]">
            An honest, skin-tone-fair read of how your skin looks today.
          </Body>
        </View>

        <ToneStrip />
      </View>

      <View className="gap-4 mb-3">
        <PrimaryButton label="Start your read" fullWidth onPress={() => router.push('/scan')} />
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

const styles = StyleSheet.create({
  swatchRow: { flexDirection: 'row', height: 30, borderRadius: 11, overflow: 'hidden' },
  swatch: { flex: 1, height: '100%' },
  swatchFirst: { borderTopLeftRadius: 11, borderBottomLeftRadius: 11 },
  swatchLast: { borderTopRightRadius: 11, borderBottomRightRadius: 11 },
});
