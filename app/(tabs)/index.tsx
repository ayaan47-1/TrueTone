import { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Screen,
  Display,
  Eyebrow,
  Body,
  Caption,
  GlassCard,
  PrimaryButton,
  SectionLabel,
  Disclaimer,
  TAB_BAR_CLEARANCE,
} from '../../src/components/ui';
import { fetchScanHistory, type Scan } from '../../src/lib/scans';
import { toDateKey } from '../../src/features/today/week';
import { WeekStrip } from '../../src/features/today/WeekStrip';
import { AffirmationCard } from '../../src/features/today/AffirmationCard';
import { MoodPicker } from '../../src/features/diary/MoodPicker';
import { getMood, setMood } from '../../src/features/diary/diary-storage';
import type { MoodValue } from '../../src/features/diary/moods';

/**
 * Today — the app home. A daily snapshot: the week strip, today's routine summary,
 * the skin-feel diary, and a daily affirmation, all in the Mist glass theme.
 * Refreshes whenever the tab regains focus (e.g. after a scan).
 */
export default function TodayScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<Scan[]>([]);
  const [mood, setMoodState] = useState<MoodValue | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const latest = history[0] ?? null;

  useFocusEffect(
    useCallback(() => {
      fetchScanHistory(30)
        .then((h) => {
          setHistory(h);
          setLoadFailed(false);
        })
        .catch(() => setLoadFailed(true));
      getMood().then(setMoodState).catch(() => {});
    }, []),
  );

  const onPickMood = (v: MoodValue) => {
    const prev = mood;
    setMoodState(v);
    // Revert the optimistic selection if the on-device write fails.
    setMood(v).catch(() => setMoodState(prev));
  };

  const scanDateKeys = history.map((s) => toDateKey(s.capturedAt));

  return (
    <Screen className="px-6" topGap={8} bottomGap={TAB_BAR_CLEARANCE}>
      <View className="gap-1 mt-2 mb-5">
        <Eyebrow>Skin, honestly</Eyebrow>
        <Display className="text-[44px]">Today</Display>
      </View>

      <WeekStrip scanDateKeys={scanDateKeys} />

      <View className="mt-6 mb-1">
        <PrimaryButton label="Start your read" fullWidth onPress={() => router.push('/scan')} />
      </View>

      <SectionLabel>Today’s routine</SectionLabel>
      {latest ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open your routine" onPress={() => router.push('/routine')}>
          <GlassCard flat intensity={26} radius={24} className="px-5 py-4 flex-row items-center justify-between">
            <View className="gap-0.5">
              <Body className="font-body-semibold text-ink">Your routine is ready</Body>
              <Caption className="text-ink-muted">
                {latest.routine.am.length} morning · {latest.routine.pm.length} evening steps
              </Caption>
            </View>
            <Caption className="text-mauve-600 text-lg">›</Caption>
          </GlassCard>
        </Pressable>
      ) : loadFailed ? (
        <GlassCard flat intensity={24} radius={24} className="px-5 py-5 items-center">
          <Caption className="text-center text-ink-muted">
            Couldn’t load your scans. Pull to refresh, or try again in a moment.
          </Caption>
        </GlassCard>
      ) : (
        <GlassCard flat intensity={24} radius={24} className="px-5 py-5 items-center">
          <Caption className="text-center text-ink-muted">
            Take your first read to get a brand-neutral routine.
          </Caption>
        </GlassCard>
      )}

      <SectionLabel>Skin diary</SectionLabel>
      <GlassCard flat intensity={26} radius={24} className="px-5 py-5 gap-4">
        <Body className="font-body-semibold text-ink">How does your skin feel today?</Body>
        <MoodPicker value={mood} onSelect={onPickMood} />
      </GlassCard>

      <View className="mt-6 mb-6">
        <AffirmationCard />
      </View>

      <Disclaimer />
    </Screen>
  );
}
