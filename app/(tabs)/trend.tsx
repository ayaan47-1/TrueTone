import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
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
    <Screen className="px-6" topGap={8} bottomGap={TAB_BAR_CLEARANCE}>
      <View className="gap-1 mt-2 mb-5">
        <Eyebrow>Your progress</Eyebrow>
        <Display className="text-[44px]">Trend</Display>
        <Body className="text-ink-soft">How your skin’s appearance is changing, scan over scan.</Body>
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
