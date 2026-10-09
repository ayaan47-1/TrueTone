import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Body, Caption, Display, GlassCard, PrimaryButton, Screen } from '../../components/ui';
import { palette } from '../../theme/tokens';

// Counsel-pending Draft A copy. Keep user-visible text verbatim with the 2026-10-06 draft.
const AI_CONSENT_COPY = {
  title: 'Optional AI routine and chat',
  disclosure:
    "If you choose this feature, TrueTone's backend sends Anthropic your derived skin-appearance score bands, skin-type label, cosmetic routine, and the chat messages you submit so Anthropic can generate the response you requested. Anthropic does not receive your face photo or your raw numeric scan scores. TrueTone does not save the chat transcript in its database; the chat screen keeps it only for the current session. Do not enter information in chat that you do not want processed for this purpose.",
  checkbox:
    'I separately consent to [LEGAL ENTITY NAME] disclosing the information described above to Anthropic for the limited purpose of generating optional cosmetic routine and chat responses.',
} as const;

export function AiConsent({
  onAllowed,
  onNotNow,
}: {
  onAllowed: () => void;
  onNotNow: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function allow() {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('record_ai_consent');
      if (!error) onAllowed();
    } catch {
      // Fail closed: chat stays unavailable unless the receipt is confirmed.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen className="px-6" topGap={24} bottomGap={24}>
      <Display accessibilityRole="header" className="text-[30px] mb-6">
        {AI_CONSENT_COPY.title}
      </Display>
      <GlassCard flat radius={22} className="px-5 py-5 gap-4">
        <Body>{AI_CONSENT_COPY.disclosure}</Body>
        <Pressable
          testID="ai-consent-check"
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => setChecked((value) => !value)}
          className="flex-row items-start gap-3 rounded-[18px] bg-white/60 px-4 py-4"
        >
          <View style={[styles.box, checked && styles.boxOn]}>
            {checked ? <Text style={styles.tick}>✓</Text> : null}
          </View>
          <Caption className="flex-1 text-[13px] leading-[19px] text-ink-soft">
            {AI_CONSENT_COPY.checkbox}
          </Caption>
        </Pressable>
      </GlassCard>
      <View className="flex-row gap-3 mt-6">
        <View className="flex-1">
          <PrimaryButton label="Not Now" variant="ghost" fullWidth onPress={onNotNow} />
        </View>
        <View className="flex-1">
          <PrimaryButton
            testID="ai-consent-submit"
            label="Allow AI Routine & Chat"
            fullWidth
            disabled={!checked || submitting}
            accessibilityState={{ disabled: !checked || submitting }}
            onPress={allow}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.sage,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: palette.sage, borderColor: palette.sage },
  tick: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
});
