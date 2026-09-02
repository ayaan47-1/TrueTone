import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Screen,
  Display,
  Body,
  Caption,
  Disclaimer,
  TAB_BAR_CLEARANCE,
  Rise,
  PressableScale,
} from '../../src/components/ui';
import { CameraGlyph } from '../../src/components/ui/tab-icons';
import { palette } from '../../src/theme/tokens';
import { fetchScanHistory, type Scan } from '../../src/lib/scans';
import { toDateKey } from '../../src/features/today/week';
import { WeekStrip } from '../../src/features/today/WeekStrip';
import { AffirmationCard } from '../../src/features/today/AffirmationCard';
import { MoodPicker } from '../../src/features/diary/MoodPicker';
import { getMood, setMood } from '../../src/features/diary/diary-storage';
import type { MoodValue } from '../../src/features/diary/moods';
import { usePersonalization } from '../../src/features/session/personalization';
import { preferencesStore } from '../../src/features/preferences/preferences-store';
import { DEFAULT_SETUP_ANSWERS } from '../../src/features/preferences/preferences-types';
import { DEMO_MODE } from '../../src/lib/supabase';
import {
  resolveForYouProfile,
  pickedForYourShade,
  featuredProducts,
} from '../../src/features/foryou/for-you-profile';
import { ProductRail } from '../../src/features/foryou/ProductRail';
import { FindYourShadeCard } from '../../src/features/foryou/FindYourShadeCard';

/**
 * For You — the app home. A daily snapshot (week strip, affirmation, skin-feel diary)
 * plus two product rails: ranked picks for the current shade and a diverse featured
 * set, all in the Mist glass theme. Refreshes whenever the tab regains focus.
 */
export default function TodayScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<Scan[]>([]);
  const [mood, setMoodState] = useState<MoodValue | null>(null);
  const activeRef = useRef(true);
  const { hasScanned, currentShade } = usePersonalization();

  const load = useCallback(() => {
    // scanDateKeys (the WeekStrip's checkmarks) is the only remaining consumer -- a
    // failure here just means an undecorated week strip, so this stays a soft no-op
    // on error, matching getMood()'s own catch below for the same reason.
    fetchScanHistory(30)
      .then((h) => {
        if (!activeRef.current) return;
        setHistory(h);
      })
      .catch(() => {});
    getMood().then((m) => activeRef.current && setMoodState(m)).catch(() => {});
  }, []);

  // Refetch on focus; guard against a stale in-flight fetch resolving after blur.
  useFocusEffect(
    useCallback(() => {
      activeRef.current = true;
      load();
      return () => {
        activeRef.current = false;
      };
    }, [load]),
  );

  const onPickMood = (v: MoodValue) => {
    const prev = mood;
    setMoodState(v);
    // Revert the optimistic selection if the on-device write fails.
    setMood(v).catch(() => setMoodState(prev));
  };

  const scanDateKeys = history.map((s) => toDateKey(s.capturedAt));
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const prefs = preferencesStore.get() ?? DEFAULT_SETUP_ANSWERS;
  const forYouProfile = resolveForYouProfile(hasScanned, currentShade, prefs, DEMO_MODE);
  const yourPicks = forYouProfile ? pickedForYourShade(forYouProfile) : [];
  const featured = featuredProducts();

  return (
    <Screen className="px-6" topGap={22} bottomGap={TAB_BAR_CLEARANCE}>
      <Rise>
        <View className="flex-row items-start justify-between gap-3 mt-2 mb-5">
          <View className="gap-1 flex-1">
            <Caption className="text-[14px] text-ink-muted">{dateLabel}</Caption>
            <Display className="text-[30px] leading-[36px]">{greeting}</Display>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Shade match"
            accessibilityHint="Opens the shade scan"
            onPress={() => router.push('/scan-gate')}
            className="items-center gap-1 mt-1"
          >
            <View className="h-11 w-11 rounded-full bg-mist-300 items-center justify-center">
              <CameraGlyph color={palette.mauve600} size={22} />
            </View>
            <Caption className="text-ink-muted">Shade match</Caption>
          </PressableScale>
        </View>
      </Rise>

      <Rise index={1}>
        <WeekStrip scanDateKeys={scanDateKeys} />
      </Rise>

      <Rise index={2}>
        <View className="mt-7">
          <AffirmationCard />
        </View>
      </Rise>

      <Rise index={3}>
        <View className="mt-7 gap-3">
          <Body className="font-semibold text-ink">How does your skin feel?</Body>
          <MoodPicker value={mood} onSelect={onPickMood} />
        </View>
      </Rise>

      <Rise index={4}>
        <View className="mt-9 gap-8">
          {forYouProfile ? (
            <ProductRail
              title="Your products"
              subtitle="Picked for your shade"
              products={yourPicks}
              profile={forYouProfile}
            />
          ) : (
            <FindYourShadeCard onFindShade={() => router.push('/scan-gate')} />
          )}
          <ProductRail
            title="Featured products"
            subtitle="A range from fair to deep"
            products={featured}
          />
        </View>
      </Rise>

      <Rise index={5}>
        <View className="mt-6"><Disclaimer /></View>
      </Rise>
    </Screen>
  );
}
