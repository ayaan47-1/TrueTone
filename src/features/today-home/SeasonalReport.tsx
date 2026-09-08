import { View, StyleSheet } from 'react-native';
import { Caption, Body, GlassCard, SectionLabel } from '../../components/ui';

export interface SeasonalReportProps {
  /** Scans completed toward the seasonal report unlock. */
  scansDone: number;
  /** Scans required to unlock the seasonal report. */
  total: number;
}

/**
 * Today-home "Seasonal report" progress card (SHELL). Shows scan progress
 * toward the seasonal report with a simple bar + cosmetic caption.
 * Props-driven only — no store/route wiring.
 */
export function SeasonalReport({ scansDone, total }: SeasonalReportProps) {
  const ratio = total > 0 ? Math.min(Math.max(scansDone / total, 0), 1) : 0;
  return (
    <GlassCard className="p-5">
      <SectionLabel>Seasonal report</SectionLabel>
      <Body className="text-ink-soft mt-2">
        {scansDone} of {total} scans logged
      </Body>
      <View style={styles.track} className="bg-ink-faint/20 mt-3">
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} className="bg-brand-green" />
      </View>
      <Caption className="text-ink-faint mt-3">
        Keep scanning to unlock your seasonal skin-appearance report.
      </Caption>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
