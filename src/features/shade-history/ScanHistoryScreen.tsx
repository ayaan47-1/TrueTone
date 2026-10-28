import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppHeader,
  Body,
  Caption,
  Display,
  Eyebrow,
  GlassCard,
  PrimaryButton,
  PressableScale,
  Screen,
  Subheading,
} from '../../components/ui';
import type { Scan } from '../../lib/scans';
import { SCAN_HISTORY_PAGE_SIZE } from '../../lib/scans';
import { formatShadeMatch } from '../shade/shade-history';
import { glass, palette } from '../../theme/tokens';
import { formatHistoryDate } from './history-format';
import { HistoryChip, ILLUSTRATIVE_CHIP_COPY } from './HistoryChip';

type HistoryState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      scans: readonly Scan[];
      hasMore: boolean;
      nextPage: 'idle' | 'loading' | 'error';
    };

interface ScanHistoryScreenProps {
  loadHistory: (offset: number, limit: number) => Promise<Scan[]>;
  clearHistory: () => Promise<void>;
  onBack: () => void;
  onOpen: (scanId: string) => void;
}

const FOOTER = 'Past matches are a record, not a measure of change.';

export function ScanHistoryScreen({ loadHistory, clearHistory, onBack, onOpen }: ScanHistoryScreenProps) {
  const [state, setState] = useState<HistoryState>({ kind: 'loading' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState(false);

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    void loadHistory(0, SCAN_HISTORY_PAGE_SIZE)
      .then((scans) => setState({
        kind: 'ready',
        scans,
        hasMore: scans.length === SCAN_HISTORY_PAGE_SIZE,
        nextPage: 'idle',
      }))
      .catch(() => setState({ kind: 'error' }));
  }, [loadHistory]);

  useEffect(load, [load]);

  const clear = async (): Promise<void> => {
    if (clearing) return;
    setClearing(true);
    setClearError(false);
    try {
      await clearHistory();
      setState((current) => current.kind === 'ready'
        ? {
            kind: 'ready',
            scans: current.scans.map((scan) => ({ ...scan, shade: null, captureMode: null })),
            hasMore: current.hasMore,
            nextPage: current.nextPage,
          }
        : current);
      setConfirmOpen(false);
    } catch {
      setClearError(true);
    } finally {
      setClearing(false);
    }
  };

  const loadMore = async (): Promise<void> => {
    if (state.kind !== 'ready' || !state.hasMore || state.nextPage === 'loading') return;
    const offset = state.scans.length;
    setState({ ...state, nextPage: 'loading' });
    try {
      const scans = await loadHistory(offset, SCAN_HISTORY_PAGE_SIZE);
      setState((current) => current.kind === 'ready'
        ? {
            kind: 'ready',
            scans: [...current.scans, ...scans],
            hasMore: scans.length === SCAN_HISTORY_PAGE_SIZE,
            nextPage: 'idle',
          }
        : current);
    } catch {
      setState((current) => current.kind === 'ready'
        ? { ...current, nextPage: 'error' }
        : current);
    }
  };

  return (
    <Screen className="px-6" edges={{ top: false }} bottomGap={32}>
      <AppHeader title="Scan History" onBack={onBack} />
      {state.kind === 'loading' ? (
        <View className="flex-1 items-center justify-center py-20">
          <Body>Loading scan history…</Body>
        </View>
      ) : null}
      {state.kind === 'error' ? (
        <View className="flex-1 items-center justify-center px-6 py-20">
          <Subheading className="text-center">Couldn&apos;t load scan history.</Subheading>
          <Body className="mt-2 text-center">Check your connection and try again.</Body>
          <View className="mt-5 w-full"><PrimaryButton label="Try again" onPress={load} fullWidth /></View>
        </View>
      ) : null}
      {state.kind === 'ready' && state.scans.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4 py-20">
          <View style={styles.emptyMark}><View style={styles.emptyDot} /></View>
          <Display className="mt-5 text-center">No scans saved yet</Display>
          <Body className="mt-3 text-center">Past shade matches will appear here after a scan.</Body>
          <View className="mt-6 w-full"><PrimaryButton label="Back to Account" onPress={onBack} fullWidth /></View>
        </View>
      ) : null}
      {state.kind === 'ready' && state.scans.length > 0 ? (
        <View className="pb-6">
          <Eyebrow className="mt-4">Your past scans</Eyebrow>
          <Display className="mt-2">Scan History</Display>
          <Body className="mt-2">Your saved shade words, newest first.</Body>
          <Caption className="mt-2">{ILLUSTRATIVE_CHIP_COPY}</Caption>
          <Eyebrow className="mb-2.5 mt-7 ml-1">Recent scans</Eyebrow>
          <View style={styles.listGap}>
            {state.scans.map((scan) => <HistoryRow key={scan.id} scan={scan} onOpen={onOpen} />)}
          </View>
          {state.hasMore ? (
            <View className="mt-5">
              <PrimaryButton
                label={state.nextPage === 'loading'
                  ? 'Loading…'
                  : state.nextPage === 'error'
                    ? 'Try loading more'
                    : 'Load more'}
                variant="ghost"
                disabled={state.nextPage === 'loading'}
                fullWidth
                onPress={() => { void loadMore(); }}
              />
            </View>
          ) : null}
          <Caption className="mt-6 text-center">{FOOTER}</Caption>
          {state.scans.some((scan) => scan.shade !== null) ? (
            <View className="mt-6 border-t pt-5" style={{ borderTopColor: palette.mist400 }}>
              <PrimaryButton
                label="Remove saved shade labels"
                variant="ghost"
                fullWidth
                onPress={() => setConfirmOpen(true)}
              />
            </View>
          ) : (
            <Body className="mt-5 text-center">
              Saved shade labels were removed. Scan dates, skin-appearance scores, routines, and other scan records remain.
              {' '}To erase scans and derived scores, go to Your Data → Delete My Data.
            </Body>
          )}
        </View>
      ) : null}
      {confirmOpen ? (
        <ClearConfirmation
          clearing={clearing}
          error={clearError}
          onCancel={() => { if (!clearing) setConfirmOpen(false); }}
          onConfirm={() => { void clear(); }}
        />
      ) : null}
    </Screen>
  );
}

function HistoryRow({ scan, onOpen }: { scan: Scan; onOpen: (scanId: string) => void }) {
  const date = formatHistoryDate(scan.capturedAt);
  const label = scan.shade?.shadeName ?? 'Shade removed';
  const details = scan.shade ? formatShadeMatch(scan.shade) : null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${date}${details ? `, ${details}` : ''}`}
      onPress={() => onOpen(scan.id)}
    >
      <GlassCard flat radius={22} className="min-h-[92px] flex-row items-center gap-4 px-5 py-4">
        <HistoryChip scanId={scan.id} shade={scan.shade} />
        <View className="flex-1">
          <Caption>{date}</Caption>
          <Subheading className="mt-0.5" numberOfLines={1}>{label}</Subheading>
          {details ? <Caption className="mt-0.5">{details}</Caption> : null}
        </View>
        <View style={styles.chevron} />
      </GlassCard>
    </PressableScale>
  );
}

function ClearConfirmation({
  clearing,
  error,
  onCancel,
  onConfirm,
}: {
  clearing: boolean;
  error: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.modalBackdrop} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cancel removing saved shade labels" onPress={onCancel} />
      <GlassCard radius={28} className="px-6 py-7" style={styles.modalCard}>
        <Subheading>Remove saved shade labels?</Subheading>
        <Body className="mt-2">
          This removes saved shade names, depth, undertone, finish, and capture labels. Scan dates, skin-appearance scores,
          {' '}routines, and other scan records remain. To erase scans and derived scores, go to Your Data → Delete My Data.
        </Body>
        {error ? <Caption accessibilityRole="alert" className="mt-3 text-red-600">Couldn&apos;t remove saved shade labels. Try again.</Caption> : null}
        <View className="mt-5 gap-3">
          <PrimaryButton label={clearing ? 'Removing…' : error ? 'Try again' : 'Remove labels'} disabled={clearing} fullWidth onPress={onConfirm} />
          <PrimaryButton label="Cancel" variant="ghost" disabled={clearing} fullWidth onPress={onCancel} />
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  listGap: { gap: 12 },
  chevron: {
    width: 9,
    height: 9,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: palette.inkFaint,
    transform: [{ rotate: '45deg' }],
  },
  emptyMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.mist200,
    borderWidth: 1,
    borderColor: palette.mist400,
  },
  emptyDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: palette.terracotta },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: -24,
    bottom: 0,
    left: -24,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: glass.backdrop,
  },
  modalCard: { width: '100%', maxWidth: 480, alignSelf: 'center' },
});
