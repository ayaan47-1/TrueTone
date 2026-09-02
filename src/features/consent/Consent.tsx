import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase, CAMERA_DEMO } from '../../lib/supabase';
import { cameraDemoSetConsent } from '../../lib/camera-demo-profile';
import { CONSENT_COPY as C } from './consent-copy';
import {
  Screen,
  GlassCard,
  Display,
  Heading,
  Body,
  Caption,
  PrimaryButton,
} from '../../components/ui';
import { palette } from '../../theme/tokens';

export function Consent({
  onConsent,
  onDecline,
}: {
  onConsent: () => void;
  onDecline: () => void;
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
    <Screen className="px-6" topGap={56} bottomGap={24}>
      <View className="gap-1 mb-7">
        <Display className="text-[30px]">Your photo stays yours</Display>
        <Body className="text-ink-muted">Review and choose before any scan can begin.</Body>
      </View>

      <GlassCard flat radius={22} className="px-5 py-5 gap-4">
        <Heading className="text-[20px]">{C.title}</Heading>
        <Body>{C.what}</Body>
        <Body>{C.purpose}</Body>
        <Body className="text-ink-muted">{C.retention}</Body>

        <Pressable
          testID="consent-check"
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => setChecked((v) => !v)}
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
      <Caption className="mt-5 text-center">Privacy Policy · Biometric Data Policy · Terms</Caption>
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
