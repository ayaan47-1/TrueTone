import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  AppHeader,
  Body,
  Caption,
  Display,
  Eyebrow,
  GlassCard,
  PrimaryButton,
  Screen,
  Subheading,
} from '../../components/ui';
import type { Scan } from '../../lib/scans';
import { formatHistoryDate, depthLabel, finishLabel, undertoneLabel } from './history-format';
import { HistoryChip } from './HistoryChip';

type DetailState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; scan: Scan | null };

interface ScanHistoryDetailScreenProps {
  scanId: string;
  loadHistory: () => Promise<Scan[]>;
  onBack: () => void;
}

export function ScanHistoryDetailScreen({ scanId, loadHistory, onBack }: ScanHistoryDetailScreenProps) {
  const [state, setState] = useState<DetailState>({ kind: 'loading' });
  const load = useCallback(() => {
    setState({ kind: 'loading' });
    void loadHistory()
      .then((scans) => setState({ kind: 'ready', scan: scans.find((scan) => scan.id === scanId) ?? null }))
      .catch(() => setState({ kind: 'error' }));
  }, [loadHistory, scanId]);

  useEffect(load, [load]);

  return (
    <Screen className="px-6" edges={{ top: false }} bottomGap={32}>
      <AppHeader title="Past Scan" onBack={onBack} />
      {state.kind === 'loading' ? <Body className="py-20 text-center">Loading saved scan…</Body> : null}
      {state.kind === 'error' ? (
        <View className="items-center py-20">
          <Subheading>Couldn&apos;t load this scan.</Subheading>
          <View className="mt-5 w-full"><PrimaryButton label="Try again" onPress={load} fullWidth /></View>
        </View>
      ) : null}
      {state.kind === 'ready' && state.scan === null ? (
        <View className="items-center py-20">
          <Subheading>This scan is no longer available.</Subheading>
          <View className="mt-5 w-full"><PrimaryButton label="Back to Scan History" onPress={onBack} fullWidth /></View>
        </View>
      ) : null}
      {state.kind === 'ready' && state.scan !== null ? <Detail scan={state.scan} /> : null}
    </Screen>
  );
}

function Detail({ scan }: { scan: Scan }) {
  const date = formatHistoryDate(scan.capturedAt);
  if (!scan.shade) {
    return (
      <View className="items-center pb-8 pt-10">
        <HistoryChip scanId={scan.id} shade={null} size={96} />
        <Display className="mt-5 text-center">Shade removed</Display>
        <Body className="mt-2 text-center">Saved shade labels were cleared. This scan date remains in your history.</Body>
        <GlassCard flat radius={22} className="mt-7 w-full px-5 py-5">
          <Caption>Saved on</Caption>
          <Subheading className="mt-1">{date}</Subheading>
        </GlassCard>
        <Caption className="mt-7 text-center">Past matches are a record, not a measure of change.</Caption>
      </View>
    );
  }

  const cards = [
    ['Depth', depthLabel(scan.shade)],
    ['Undertone', undertoneLabel(scan.shade)],
    ['Finish', finishLabel(scan.shade)],
    ['Saved on', date],
  ] as const;

  return (
    <View className="pb-8 pt-4">
      <Eyebrow>Past scan</Eyebrow>
      <Caption className="mt-2">{date}</Caption>
      <GlassCard flat radius={28} className="mt-5 items-center px-6 py-7">
        <HistoryChip scanId={scan.id} shade={scan.shade} size={96} />
        <Eyebrow className="mt-5">Matched shade</Eyebrow>
        <Display className="mt-2 text-center">{scan.shade.shadeName}</Display>
        <Body className="mt-1 text-center">{depthLabel(scan.shade)}</Body>
      </GlassCard>
      <View className="mt-3 flex-row flex-wrap" style={{ gap: 12 }}>
        {cards.map(([label, value]) => (
          <GlassCard key={label} flat radius={22} className="px-5 py-5" style={{ width: '48%', flexGrow: 1 }}>
            <Caption>{label}</Caption>
            <Subheading className="mt-1">{value}</Subheading>
          </GlassCard>
        ))}
      </View>
      <Caption className="mt-7 text-center">Past matches are a record, not a measure of change.</Caption>
    </View>
  );
}
