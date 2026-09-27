// src/features/allergens/HealthDataConsent.tsx
// Design C15: its own consent, before the first save of any flags, never bundled with the
// biometric consent. Confirm is gated on the "I agree" box exactly like Consent.tsx. Only a
// receipt is sent (wa_health); decline writes nothing. PLACEHOLDER copy — counsel review (D2).
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { GlassCard, Heading, Body, Caption, PrimaryButton } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { ALLERGEN_COPY } from '../../content/allergen-copy';
import { recordHealthDataConsent } from './health-consent';

const C = ALLERGEN_COPY;

type Props = { userId?: string | null; onConsented: () => void; onDecline: () => void; onOpenPolicy?: () => void };

export function HealthDataConsent({ userId, onConsented, onDecline, onOpenPolicy }: Props) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (!checked || busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await recordHealthDataConsent(userId);
    setBusy(false);
    if (ok) onConsented();
    else setFailed(true);
  }

  const disabled = !checked || busy;
  return (
    <View className="gap-4">
      <GlassCard flat radius={22} className="px-5 py-5 gap-4">
        <Heading accessibilityRole="header" className="text-[20px]">{C.consent.title}</Heading>
        <Body>{C.consent.body}</Body>
        {onOpenPolicy ? (
          <Pressable accessibilityRole="link" onPress={onOpenPolicy} hitSlop={12}>
            <Caption className="text-ink-soft underline">{C.consent.policyLink}</Caption>
          </Pressable>
        ) : null}
        <Pressable
          testID="health-consent-check"
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => setChecked((v) => !v)}
          className="flex-row items-center gap-3 rounded-[18px] bg-white/60 px-4 py-4 min-h-[48px]"
        >
          <View style={[styles.box, checked && styles.boxOn]}>
            {checked ? <Text style={styles.tick}>✓</Text> : null}
          </View>
          <Caption className="flex-1 text-[13px] leading-[19px] text-ink-soft">{C.consent.agree}</Caption>
        </Pressable>
      </GlassCard>
      <Caption className="text-[11px] leading-[17px] text-ink-muted">{C.disclaimer}</Caption>
      {failed ? <Body className="text-ink-soft">{C.consent.failed}</Body> : null}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <PrimaryButton
            testID="health-consent-decline"
            label={C.consent.decline}
            variant="ghost"
            fullWidth
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            onPress={() => { if (!busy) onDecline(); }}
          />
        </View>
        <View className="flex-1">
          <PrimaryButton
            testID="health-consent-submit"
            label={C.consent.confirm}
            fullWidth
            disabled={disabled}
            accessibilityState={{ disabled }}
            onPress={confirm}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: palette.sage,
    backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: palette.sage, borderColor: palette.sage },
  tick: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
});
