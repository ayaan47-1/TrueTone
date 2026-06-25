import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Result } from '../../src/features/read/Result';
import { MistBackground, GlassCard, Body, PrimaryButton } from '../../src/components/ui';
import { fetchScanHistory } from '../../src/lib/scans';
import { SKIN_TYPE_FEELS, type SkinTypeFeel } from '../../src/content/cosmetic-vocab';
import type { ScoreVector } from '../../src/features/read/read-types';
import type { ScoreSnapshot } from '../../src/features/age/age-types';

type Status = 'loading' | 'ready' | 'empty' | 'error';

// The DB check-constrains skin_type_feel to the four values; narrow defensively.
function toSkinTypeFeel(value: string): SkinTypeFeel {
  return (SKIN_TYPE_FEELS as readonly string[]).includes(value)
    ? (value as SkinTypeFeel)
    : 'combination';
}

export default function ResultRoute() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [scores, setScores] = useState<ScoreVector | null>(null);
  const [prev, setPrev] = useState<ScoreVector | null>(null);
  const [skinType, setSkinType] = useState<SkinTypeFeel>('combination');
  const [trendHistory, setTrendHistory] = useState<ScoreSnapshot[]>([]);
  const [skinAge, setSkinAge] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const history = await fetchScanHistory(5); // more samples for the trend
        const latest = history[0];
        if (!latest) {
          setStatus('empty');
          return;
        }
        setScores(latest.scores);
        setSkinType(toSkinTypeFeel(latest.skinType));
        setPrev(history[1]?.scores ?? null);
        // Build ScoreSnapshot[] (newest-first) for the age/trend card.
        setTrendHistory(history.map((s) => ({ capturedAt: s.capturedAt, scores: s.scores })));
        setSkinAge(latest.skinAge ?? null);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  if (status === 'loading') {
    return (
      <MistBackground>
        <View className="flex-1 items-center justify-center px-8">
          <GlassCard className="px-7 py-8 items-center" radius={32}>
            <Body className="text-center">Preparing your read…</Body>
          </GlassCard>
        </View>
      </MistBackground>
    );
  }

  if (status === 'error') {
    return (
      <MistBackground>
        <View className="flex-1 items-center justify-center px-8">
          <GlassCard className="px-7 py-8 items-center gap-5" radius={32}>
            <Body className="text-center">Couldn&apos;t load your read. Please try again.</Body>
            <PrimaryButton label="Back to Home" fullWidth onPress={() => router.replace('/')} />
          </GlassCard>
        </View>
      </MistBackground>
    );
  }

  if (status === 'empty' || !scores) {
    return (
      <MistBackground>
        <View className="flex-1 items-center justify-center px-8">
          <GlassCard className="px-7 py-8 items-center gap-5" radius={32}>
            <Body className="text-center">No scan yet. Your skin reads will show up here.</Body>
            <PrimaryButton label="Back to Home" fullWidth onPress={() => router.replace('/')} />
          </GlassCard>
        </View>
      </MistBackground>
    );
  }

  return <Result scores={scores} skinType={skinType} prev={prev} history={trendHistory} skinAge={skinAge} />;
}
