import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchScanHistory, type Scan } from '../src/lib/scans';
import { RoutineView } from '../src/features/recommend/RoutineView';
import { computePersonalBaseline } from '../src/features/personalize/personal-baseline';
import { computePersonalDeviation } from '../src/features/personalize/personal-deviation';
import { emphasizeRoutine } from '../src/features/recommend/emphasize-routine';
import type { Routine } from '../src/features/recommend/routine-types';
import { MistBackground, GlassCard, Body } from '../src/components/ui';

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
 * Routine screen — the brand-neutral routine derived from the latest scan, with a
 * link into the scores-only chat. No longer a bottom tab (the tab set is
 * Shop / Today / Trend / You); reached from the Today card's "Your routine is ready"
 * link at the root route `/routine`.
 */
export default function RoutineRoute() {
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true; // guard against setState after unmount
    void (async () => {
      try {
        const history = await fetchScanHistory(10);
        if (!active) return;
        const latest = history[0] ?? null;
        setScan(latest);
        if (latest) {
          // Display-time emphasis from the personal baseline; the stored routine stays
          // canonical. Cold start (baseline null) → the plain routine, exactly as today.
          const baseline = computePersonalBaseline(
            history.map((s) => ({ scores: s.scores, isStub: s.isStub, captureQuality: s.captureQuality })),
          );
          setRoutine(
            baseline
              ? emphasizeRoutine(latest.routine, computePersonalDeviation(latest.scores, baseline))
              : latest.routine,
          );
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <StateCard>Loading…</StateCard>;
  if (failed) return <StateCard>Couldn&rsquo;t load your routine. Pull to retry.</StateCard>;
  if (!scan || !routine) return <StateCard>No scan yet — run a scan to see your routine.</StateCard>;
  return (
    <RoutineView
      routine={routine}
      onAsk={() => router.push({ pathname: '/scan/chat', params: { scanId: scan.id } })}
    />
  );
}
