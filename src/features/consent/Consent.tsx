import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase, CAMERA_DEMO } from '../../lib/supabase';
import { cameraDemoSetConsent } from '../../lib/camera-demo-profile';
import type { DocKey } from '../../content/manifest';
import { CONSENT_COPY as C } from './consent-copy';
import {
  Screen,
  HEADER_CLEARANCE,
  GlassCard,
  Display,
  Body,
  Caption,
  PrimaryButton,
} from '../../components/ui';
import { palette } from '../../theme/tokens';

const POLICY_LINKS: { key: DocKey; label: string }[] = [
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'biometric', label: 'Biometric Data Policy' },
  { key: 'retention', label: 'Data Retention Schedule' },
  { key: 'wa_health', label: 'WA Consumer Health Data Policy' },
  { key: 'terms', label: 'Terms of Use' },
];

export function Consent({
  onConsent,
  onDecline,
  onOpenPolicy = () => undefined,
}: {
  onConsent: () => void;
  onDecline: () => void;
  onOpenPolicy?: (docKey: DocKey) => void;
}) {
  const [checked, setChecked] = useState(false);
  async function consent() {
    // CAMERA_DEMO: same real affirmative tap against the same disclosure copy above, no live
    // backend -- persists to camera-demo-profile.ts's local state (Dwight tt-cam-mode-ruling).
    if (CAMERA_DEMO) {
      cameraDemoSetConsent();
      onConsent();
      return;
    }
    const { error } = await supabase.rpc('record_consent');
    if (!error) onConsent();
  }
  return (
    <Screen className="px-6" topGap={HEADER_CLEARANCE} bottomGap={24}>
      <Display accessibilityRole="header" className="text-[30px] mb-6">{C.title}</Display>

      <GlassCard flat radius={22} className="px-5 py-5 gap-4">
        <Body>{C.adult}</Body>
        <Disclosure heading={C.photoHeading} body={C.photo} />
        <Disclosure heading={C.storageHeading} body={C.storage} />
        <Disclosure heading={C.purposeHeading} body={C.purpose} />
        <Disclosure heading={C.retentionHeading} body={C.retention} />
        <Disclosure heading={C.saleHeading} body={C.sale} />
        <Body>{C.contact}</Body>

        <Pressable
          testID="consent-check"
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => setChecked((value) => !value)}
          className="flex-row items-start gap-3 mt-2 rounded-[18px] bg-white/60 px-4 py-4"
        >
          <View style={[styles.box, checked && styles.boxOn]}>
            {checked ? <Text style={styles.tick}>✓</Text> : null}
          </View>
          <Caption className="flex-1 text-[13px] leading-[19px] text-ink-soft">{C.checkbox}</Caption>
        </Pressable>
      </GlassCard>

      <View className="flex-row gap-3 mt-6">
        <View className="flex-1">
          <PrimaryButton label="Decline" variant="ghost" fullWidth onPress={onDecline} />
        </View>
        <View className="flex-1">
          <PrimaryButton
            testID="consent-submit"
            label="I Consent"
            fullWidth
            disabled={!checked}
            accessibilityState={{ disabled: !checked }}
            onPress={consent}
          />
        </View>
      </View>

      <View className="flex-row flex-wrap justify-center gap-x-3 gap-y-2 mt-5">
        {POLICY_LINKS.map(({ key, label }) => (
          <Pressable
            key={key}
            testID={`policy-link-${key}`}
            accessibilityRole="link"
            onPress={() => onOpenPolicy(key)}
          >
            <Caption className="text-mauve-600 underline">{label}</Caption>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function Disclosure({ heading, body }: { heading: string; body: string }) {
  return (
    <Body>
      <Text className="font-body-semibold text-ink">{heading} </Text>
      {body}
    </Body>
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
