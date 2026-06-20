import { useState } from 'react';
import { View, TextInput } from 'react-native';
import { supabase } from '../../lib/supabase';
import { computeIs18Plus } from './age';
import {
  MistBackground,
  GlassSheet,
  Display,
  Heading,
  Body,
  Caption,
  Eyebrow,
  PrimaryButton,
} from '../../components/ui';
import { palette } from '../../theme/tokens';

export function AgeGate({ userId, onPass }: { userId: string; onPass: () => void }) {
  const [value, setValue] = useState('');
  const [blocked, setBlocked] = useState(false);
  async function submit() {
    const dob = new Date(value);
    if (isNaN(dob.getTime())) { setBlocked(false); return; }
    if (!computeIs18Plus(dob, new Date())) { setBlocked(true); return; } // discard DOB
    await supabase.from('profiles')
      .update({ is_18_plus: true, age_verified_at: new Date().toISOString() })
      .eq('id', userId);
    onPass();
  }

  if (blocked)
    return (
      <MistBackground>
        <GlassSheet className="px-7 py-9 items-center gap-3">
          <Eyebrow>Sorry</Eyebrow>
          <Display className="text-center text-3xl">Adults only</Display>
          <Body className="text-center">TrueTone is available to adults 18 and over.</Body>
        </GlassSheet>
      </MistBackground>
    );

  return (
    <MistBackground>
      <GlassSheet className="px-7 py-8 gap-5">
        <View className="gap-2">
          <Eyebrow>A quick check</Eyebrow>
          <Heading>Enter your date of birth</Heading>
          <Caption>TrueTone is for adults 18 and over. We use this only to confirm your age.</Caption>
        </View>
        <TextInput
          testID="dob-input"
          placeholder="YYYY-MM-DD"
          placeholderTextColor={palette.inkFaint}
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          className="rounded-2xl border border-white/70 bg-white/60 px-4 py-3.5 text-base font-body text-ink"
        />
        <PrimaryButton testID="dob-submit" label="Continue" fullWidth onPress={submit} />
      </GlassSheet>
    </MistBackground>
  );
}
