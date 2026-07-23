import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Screen,
  Display,
  Eyebrow,
  Body,
  Caption,
  GlassCard,
  PrimaryButton,
  SectionLabel,
  TAB_BAR_CLEARANCE,
} from '../../src/components/ui';
import { fetchScanHistory, type Scan } from '../../src/lib/scans';
import { AgeTrendCard } from '../../src/features/age/AgeTrendCard';
import { formatShortDate } from '../../src/features/today/week';
import { SKIN_TYPE_LABELS } from '../../src/content/cosmetic-vocab';
import { RoutineFeedbackPrompt } from '../../src/features/feedback/RoutineFeedbackPrompt';
import { palette } from '../../src/theme/tokens';

type Status = 'loading' | 'ready' | 'error';

/**
 * Trend tab — within-user progress over time: the freshness trend / flag-gated
 * skin-age (AgeTrendCard) and a timeline of recent reads. Honest, relative framing
 * only (no population claim).
 */
export default function TrendScreen() {
  const [history, setHistory] = useState<Scan[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const activeRef = useRef(true);

  const load = useCallback(() => {
    setStatus('loading');
    fetchScanHistory(30)
      .then((h) => {
        if (!activeRef.current) return;
        setHistory(h);
        setStatus('ready');
      })
      .catch(() => {
        if (activeRef.current) setStatus('error');
      });
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

  const snapshots = useMemo(
    () => history.map((s) => ({ capturedAt: s.capturedAt, scores: s.scores })),
    [history],
  );
  const skinAge = history[0]?.skinAge ?? null;

  return (
    <Screen className="px-6" topGap={24} bottomGap={TAB_BAR_CLEARANCE}>
      <View className="gap-1 mt-2 mb-5">
        <Display className="text-[30px]">Trend</Display>
        <Body className="text-ink-muted">{history.length ? `Last ${Math.min(history.length, 4)} scans` : 'Your progress over time'}</Body>
      </View>

      {status === 'loading' ? (
        <GlassCard className="px-6 py-8 items-center" radius={28}>
          <Caption className="text-ink-muted">Loading your trend…</Caption>
        </GlassCard>
      ) : status === 'error' ? (
        <GlassCard className="px-6 py-8 items-center gap-4" radius={28}>
          <Caption className="text-center text-ink-muted">Couldn’t load your trend.</Caption>
          <PrimaryButton label="Try again" variant="glass" onPress={load} />
        </GlassCard>
      ) : history.length === 0 ? (
        <GlassCard className="px-6 py-8 items-center" radius={28}>
          <Caption className="text-center text-ink-muted">
            Take a few reads to see your trend here.
          </Caption>
        </GlassCard>
      ) : (
        <>
          <TrendChart />

          <SectionLabel>Check-in streak</SectionLabel>
          <View className="flex-row gap-2">
            {Array.from({ length: 7 }, (_, index) => (
              <View key={index} style={[styles.streak, index < Math.min(history.length, 7) && styles.streakOn]} />
            ))}
          </View>

          {history.length > 1 && history[0].routineHelpful === null ? (
            <View className="mt-6">
              <RoutineFeedbackPrompt scanId={history[0].id} />
            </View>
          ) : null}

          <AgeTrendCard history={snapshots} skinAge={skinAge} />

          <SectionLabel>Recent reads</SectionLabel>
          <GlassCard flat intensity={26} radius={24} className="px-5 py-1">
            {history.map((s, i) => (
              <View
                key={s.id}
                className={`flex-row justify-between items-center py-3.5 ${
                  i === history.length - 1 ? '' : 'border-b border-white/40'
                }`}
              >
                <Body className="text-ink">{formatShortDate(s.capturedAt)}</Body>
                <Caption className="text-ink-muted">
                  {SKIN_TYPE_LABELS[s.skinType as keyof typeof SKIN_TYPE_LABELS] ?? s.skinType}
                </Caption>
              </View>
            ))}
          </GlassCard>
        </>
      )}
    </Screen>
  );
}

function TrendChart() {
  return (
    <GlassCard flat radius={22} className="px-5 pt-6 pb-5">
      <View style={styles.chart}>
        <View style={[styles.line, { left: '4%', top: 72, width: '30%', transform: [{ rotate: '-8deg' }] }]} />
        <View style={[styles.line, { left: '33%', top: 66, width: '27%', transform: [{ rotate: '6deg' }] }]} />
        <View style={[styles.line, { left: '58%', top: 56, width: '36%', transform: [{ rotate: '-15deg' }] }]} />
        <View style={styles.endDot} />
      </View>
      <View className="flex-row justify-between">
        <Caption>Duller</Caption>
        <Caption>Fresher</Caption>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  chart: { height: 120, position: 'relative' },
  line: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: palette.sage },
  endDot: { position: 'absolute', right: '4%', top: 29, width: 14, height: 14, borderRadius: 7, backgroundColor: palette.sage },
  streak: { flex: 1, height: 28, borderRadius: 10, backgroundColor: palette.mist300 },
  streakOn: { backgroundColor: palette.sage },
});
