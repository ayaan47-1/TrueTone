import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Result } from '../../src/features/read/Result';
import { fetchScanHistory } from '../../src/lib/scans';
import { SKIN_TYPE_FEELS, type SkinTypeFeel } from '../../src/content/cosmetic-vocab';
import type { ScoreVector } from '../../src/features/read/read-types';

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

  useEffect(() => {
    void (async () => {
      try {
        const history = await fetchScanHistory(2); // latest + the one before, for trend arrows
        const latest = history[0];
        if (!latest) {
          setStatus('empty');
          return;
        }
        setScores(latest.scores);
        setSkinType(toSkinTypeFeel(latest.skinType));
        setPrev(history[1]?.scores ?? null);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Preparing your read…</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center mb-4">Couldn&apos;t load your read. Please try again.</Text>
        <Pressable className="p-4 bg-violet-600 rounded-xl" onPress={() => router.replace('/')}>
          <Text className="text-white">Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'empty' || !scores) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center mb-4">No scan yet. Your skin reads will show up here.</Text>
        <Pressable className="p-4 bg-violet-600 rounded-xl" onPress={() => router.replace('/')}>
          <Text className="text-white">Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return <Result scores={scores} skinType={skinType} prev={prev} />;
}
