import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, CAMERA_DEMO } from '../../lib/supabase';
import { cameraDemoSetIs18 } from '../../lib/camera-demo-profile';
import { computeIs18Plus } from './age';
import {
  MistBackground,
  Screen,
  HEADER_CLEARANCE,
  GlassCard,
  Display,
  Heading,
  Body,
  Caption,
  PrimaryButton,
} from '../../components/ui';

// Local, user-scoped "already verified" record so a returning user isn't asked to pick a
// birth date on every launch. Holds only the derived pass + when -- never the DOB itself.
const VERIFICATION_KEY_PREFIX = 'age-gate:verified:';

interface StoredVerification {
  userId: string;
  verifiedAt: string;
}

function verificationKey(userId: string): string {
  return `${VERIFICATION_KEY_PREFIX}${userId}`;
}

function isValidVerification(raw: unknown, userId: string): raw is StoredVerification {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as Record<string, unknown>).userId === userId &&
    typeof (raw as Record<string, unknown>).verifiedAt === 'string'
  );
}

const DEFAULT_PICKER_DATE = new Date(2000, 0, 1);

export function AgeGate({ userId, onPass }: { userId: string; onPass: () => void }) {
  const [dob, setDob] = useState(DEFAULT_PICKER_DATE);
  const [blocked, setBlocked] = useState(false);

  // Render the picker immediately and check the stored verification in the background: a valid
  // same-user record skips straight to onPass, anything else just leaves the picker up. There is
  // no loading-null gate, so this effect never flips render-visible state (a hidden loading state
  // that reveals late is what destabilised RNTL's act); a brief picker flash before an existing
  // user is passed through is preferable to that.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(verificationKey(userId));
        if (raw == null) return;
        const parsed: unknown = JSON.parse(raw);
        if (!cancelled && isValidVerification(parsed, userId)) {
          onPass();
        }
      } catch {
        // Corrupt record (bad JSON, wrong shape, different user) -- leave the picker up.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check for a new userId
  }, [userId]);

  function onChangeDob(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) setDob(selected);
  }

  async function submit() {
    if (!computeIs18Plus(dob, new Date())) { setBlocked(true); return; } // discard DOB
    // CAMERA_DEMO: same real pass, no live backend (avoids the plain-HTTP/ATS blocker) --
    // persists to camera-demo-profile.ts's local state instead (Dwight tt-cam-mode-ruling).
    if (CAMERA_DEMO) {
      cameraDemoSetIs18();
    } else {
      const { error } = await supabase.from('profiles')
        .update({ is_18_plus: true, age_verified_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) return; // backend failure must not write local verification
    }
    const record: StoredVerification = { userId, verifiedAt: new Date().toISOString() };
    await AsyncStorage.setItem(verificationKey(userId), JSON.stringify(record));
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
    <Screen className="px-6" scroll={false} topGap={HEADER_CLEARANCE} bottomGap={24}>
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
          <DateTimePicker
            testID="dob-picker"
            value={dob}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            onChange={onChangeDob}
            accessibilityLabel="Date of birth"
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
