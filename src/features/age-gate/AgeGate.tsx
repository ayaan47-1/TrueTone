import { useState } from 'react';
import { View, TextInput, Text } from 'react-native';
import { supabase } from '../../lib/supabase';
import { computeIs18Plus } from './age';
import {
  MistBackground,
  Screen,
  GlassCard,
  Display,
  Heading,
  Body,
  Caption,
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
        <View className="flex-1 items-center justify-center px-6">
          <GlassCard className="px-7 py-9 items-center gap-3">
            <Display accessibilityRole="header" className="text-center text-3xl">Adults only</Display>
            <Body className="text-center">TrueTone is available to adults 18 and over.</Body>
          </GlassCard>
        </View>
      </MistBackground>
    );

  return (
    <Screen className="px-6" scroll={false} topGap={56} bottomGap={24}>
      <View className="flex-1">
        <View className="gap-1 mb-8">
          <Display accessibilityRole="header" className="text-[30px]">Before we begin</Display>
          <Body className="text-ink-muted">Quick, one-time essentials.</Body>
        </View>

        <GlassCard flat radius={22} className="px-5 py-5 mb-3 flex-row items-center gap-4">
          <View className="h-12 w-12 rounded-2xl bg-mist-300 items-center justify-center"><Body>US</Body></View>
          <View className="flex-1"><Body className="font-semibold text-ink">United States</Body><Caption>TrueTone is available in your region</Caption></View>
          {/* Semantic "available" state, not a decorative dot: a check reinforces the row copy. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="h-6 w-6 rounded-full bg-sage items-center justify-center"
          >
            <Text className="text-white text-[13px] font-bold leading-4">✓</Text>
          </View>
        </GlassCard>

        <GlassCard flat radius={22} className="px-5 py-5 gap-4">
          <Heading accessibilityRole="header" className="text-[19px]">Confirm your date of birth</Heading>
          <TextInput
            testID="dob-input"
            placeholder="YYYY-MM-DD"
            placeholderTextColor={palette.inkFaint}
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            accessibilityLabel="Date of birth"
            accessibilityHint="Enter your date of birth as year, month, day"
            className="rounded-[18px] bg-white/80 px-5 py-4 text-center text-base text-ink"
          />
          <Caption>Must be 18+. We don&apos;t store this date — only that you&apos;re eligible.</Caption>
        </GlassCard>

        <View className="mt-auto pt-7">
          <PrimaryButton testID="dob-submit" label="Continue" fullWidth onPress={submit} />
          <Caption className="mt-4 text-center">Privacy Policy · Terms</Caption>
        </View>
      </View>
    </Screen>
  );
}
