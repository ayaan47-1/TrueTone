import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchLatestScan, type Scan } from '../../src/lib/scans';
import { RoutineView } from '../../src/features/recommend/RoutineView';
import { MistBackground, GlassCard, Body } from '../../src/components/ui';

function StateCard({ children }: { children: React.ReactNode }) {
  return (
    <MistBackground>
      <View className="flex-1 items-center justify-center px-8">
        <GlassCard className="px-7 py-8 items-center" radius={32}>
          <Body className="text-center">{children}</Body>
        </GlassCard>
      </View>
    </MistBackground>
  );
}

/**
 * Routine tab — the brand-neutral routine derived from the latest scan, with a
 * link into the scores-only chat. Reachable from the tab bar (previously this
 * lived at the orphaned /scan/routine route).
 */
export default function RoutineRoute() {
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchLatestScan()
      .then(setScan)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <StateCard>Loading…</StateCard>;
  if (failed) return <StateCard>Couldn&rsquo;t load your routine. Pull to retry.</StateCard>;
  if (!scan) return <StateCard>No scan yet — run a scan to see your routine.</StateCard>;
  return (
    <RoutineView
      routine={scan.routine}
      onAsk={() => router.push({ pathname: '/scan/chat', params: { scanId: scan.id } })}
    />
  );
}
