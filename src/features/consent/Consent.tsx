import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { CONSENT_COPY as C } from './consent-copy';
import {
  MistBackground,
  GlassSheet,
  Heading,
  Body,
  Caption,
  Eyebrow,
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
    const { error } = await supabase.rpc('record_consent');
    if (!error) onConsent();
  }
  return (
    <MistBackground>
      <GlassSheet className="px-7 py-8 gap-4">
        <View className="gap-2">
          <Eyebrow>Biometric consent</Eyebrow>
          <Heading>{C.title}</Heading>
        </View>
        <Body>{C.what}</Body>
        <Body>{C.purpose}</Body>
        <Body className="text-ink-muted">{C.retention}</Body>

        <Pressable
          testID="consent-check"
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => setChecked((v) => !v)}
          className="flex-row items-start gap-3 mt-1"
        >
          <View style={[styles.box, checked && styles.boxOn]}>
            {checked ? <Text style={styles.tick}>✓</Text> : null}
          </View>
          <Caption className="flex-1 text-[13px] leading-[19px] text-ink-soft">{C.checkbox}</Caption>
        </Pressable>

        <View className="flex-row gap-3 mt-3">
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
      </GlassSheet>
    </MistBackground>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.mauve400,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: palette.mauve500, borderColor: palette.mauve500 },
  tick: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
});
