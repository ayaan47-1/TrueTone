import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchScanHistory, type Scan } from '../src/lib/scans';
import { DEMO_MODE } from '../src/lib/supabase';
import { useProfile } from '../src/lib/profile-context';
import { computePersonalBaseline } from '../src/features/personalize/personal-baseline';
import { computePersonalDeviation } from '../src/features/personalize/personal-deviation';
import { emphasizeRoutine } from '../src/features/recommend/emphasize-routine';
import { ScanRoutineSuggestions } from '../src/features/recommend/ScanRoutineSuggestions';
import type { Routine } from '../src/features/recommend/routine-types';
import { RoutineEditor } from '../src/features/routine/components/RoutineEditor';
import { shelfStore } from '../src/features/shop/shelf-store';
import { usePurchasedIds } from '../src/features/checkout/order-history-store';
import { Screen, HEADER_CLEARANCE, Display, Caption, GlassCard, PressableScale, Body, Rise } from '../src/components/ui';
import { palette } from '../src/theme/tokens';

type ScanState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'none' }
  | { kind: 'ready'; scan: Scan; routine: Routine };

/** Latest scan routine, emphasized against the personal baseline (display-time only). */
async function loadScanRoutine(): Promise<ScanState> {
  const history = await fetchScanHistory(10);
  const latest = history[0];
  if (!latest) return { kind: 'none' };
  const baseline = computePersonalBaseline(
    history.map((s) => ({ scores: s.scores, isStub: s.isStub, captureQuality: s.captureQuality })),
  );
  const routine = baseline
    ? emphasizeRoutine(latest.routine, computePersonalDeviation(latest.scores, baseline))
    : latest.routine;
  return { kind: 'ready', scan: latest, routine };
}

/**
 * Routine page (`/routine`, from Home's Routine quick action and routine card). The user's own
 * on-device AM/PM routine comes first and is always editable here: add, edit and remove steps,
 * with purchased + saved items suggested first. Below it, the brand-neutral suggestions from the
 * latest scan. That fetch needs the backend, so it can fail on its own without blocking the page
 * (and is skipped in demo builds, which have no backend); Try again and pull-to-refresh refetch.
 */
export default function RoutineRoute() {
  const router = useRouter();
  const { userId } = useProfile();
  const purchasedIds = usePurchasedIds();
  const [scanState, setScanState] = useState<ScanState>(DEMO_MODE ? { kind: 'none' } : { kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  // Only the newest request may set state, so a slow older response can't overwrite it.
  const latestRequest = useRef(0);

  /** Refetch the scan suggestions. `quiet` (pull-to-refresh) keeps what's shown meanwhile. */
  const refetch = useCallback(async (quiet = false) => {
    if (DEMO_MODE) return;
    const request = ++latestRequest.current;
    if (!quiet) setScanState({ kind: 'loading' });
    const next = await loadScanRoutine().catch((): ScanState => ({ kind: 'failed' }));
    if (mounted.current && request === latestRequest.current) setScanState(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refetch();
    return () => {
      mounted.current = false;
    };
  }, [refetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch(true);
    if (mounted.current) setRefreshing(false);
  }, [refetch]);

  return (
    <Screen
      className="px-6"
      topGap={HEADER_CLEARANCE}
      bottomGap={120}
      scrollTestID="routine-scroll"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.inkSoft} />}
    >
      <Rise>
        <View className="mb-5 mt-2">
          <Display className="text-[30px]">Your routine</Display>
        </View>
      </Rise>
      <Rise index={1}>
        <RoutineEditor userId={userId} purchasedIds={purchasedIds} savedIds={shelfStore.get()} />
      </Rise>
      <Rise index={2}>
        <View className="mt-4">
          <ScanSection
            state={scanState}
            onRetry={() => void refetch()}
            onAsk={(scanId) => router.push({ pathname: '/scan/chat', params: { scanId } })}
          />
        </View>
      </Rise>
      <Caption className="mt-6 px-1 text-[11px]">
        This describes how your skin looks and suggests cosmetic habits — it is not medical advice.
      </Caption>
    </Screen>
  );
}

function ScanSection({
  state,
  onRetry,
  onAsk,
}: {
  state: ScanState;
  onRetry: () => void;
  onAsk: (scanId: string) => void;
}) {
  if (state.kind === 'ready') {
    return <ScanRoutineSuggestions routine={state.routine} onAsk={() => onAsk(state.scan.id)} />;
  }
  return (
    <GlassCard flat radius={22} className="px-5 py-4">
      {state.kind === 'loading' ? <Caption>Loading suggestions from your last scan…</Caption> : null}
      {state.kind === 'none' ? <Caption>Run a scan to get habit suggestions for your skin.</Caption> : null}
      {state.kind === 'failed' ? (
        <View className="flex-row items-center justify-between">
          <Caption className="flex-1">Couldn&rsquo;t load suggestions from your last scan.</Caption>
          <PressableScale accessibilityRole="button" onPress={onRetry} hitSlop={8} className="py-1 pl-3">
            <Body className="font-semibold text-sage">Try again</Body>
          </PressableScale>
        </View>
      ) : null}
    </GlassCard>
  );
}
