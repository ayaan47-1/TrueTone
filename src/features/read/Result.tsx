// src/features/read/Result.tsx
import { View, Text, StyleSheet } from 'react-native';
import { SKIN_TYPE_LABELS, type Dimension, type SkinTypeFeel } from '../../content/cosmetic-vocab';
import { toBand, direction } from './bands';
import { assertCosmetic } from '../../lib/cosmetic-filter';
import type { ScoreVector } from './read-types';
import { Screen, GlassCard, Display, Eyebrow, Body, Caption } from '../../components/ui';
import { palette, bandTint, type BandTone } from '../../theme/tokens';

interface ResultProps {
  scores: ScoreVector;
  skinType: SkinTypeFeel;
  prev: ScoreVector | null; // previous scan for trend arrows (null on first scan)
}

const QUALITY_DIMS: Dimension[] = ['hydration', 'oiliness', 'texture', 'pores'];
const APPEARANCE_DIMS: Dimension[] = ['darkSpots', 'redness', 'fineLines', 'darkCircles'];
const LABELS: Record<Dimension, string> = {
  hydration: 'Hydration look', oiliness: 'Oiliness', texture: 'Texture', pores: 'Pores',
  darkSpots: 'Dark spots', redness: 'Redness', fineLines: 'Fine lines', darkCircles: 'Dark circles',
};
const ARROW: Record<'up' | 'down' | 'same', string> = { up: '↑', down: '↓', same: '' };

// Gentle, on-brand tone per band index (low → high). Uses the existing sage
// ("looks settled") / clay ("worth a look") tokens; mauve stays neutral. This is
// presentation only — the band *label* text is unchanged and still drives meaning.
const TONE: Record<Dimension, readonly [BandTone, BandTone, BandTone]> = {
  hydration: ['clay', 'mauve', 'sage'],
  oiliness: ['clay', 'sage', 'clay'],
  texture: ['sage', 'mauve', 'clay'],
  pores: ['sage', 'mauve', 'clay'],
  darkSpots: ['sage', 'mauve', 'clay'],
  redness: ['sage', 'mauve', 'clay'],
  fineLines: ['sage', 'mauve', 'clay'],
  darkCircles: ['sage', 'mauve', 'clay'],
};

function Row({ dim, scores, prev, last }: { dim: Dimension; scores: ScoreVector; prev: ScoreVector | null; last: boolean }) {
  const band = toBand(dim, scores[dim]);
  assertCosmetic([band.label]); // last-line compliance check before display
  const dir = direction(scores[dim], prev ? prev[dim] : null);
  const tint = bandTint[TONE[dim][band.index]];
  return (
    <View
      className={`flex-row justify-between items-center px-5 py-3.5 ${last ? '' : 'border-b border-white/40'}`}
    >
      <Body className="text-ink">{LABELS[dim]}</Body>
      <View style={[styles.pill, { backgroundColor: tint.bg }]}>
        <Text className="font-body-semibold text-[12.5px]" style={{ color: tint.fg }}>
          {band.label} {ARROW[dir]}
        </Text>
      </View>
    </View>
  );
}

function Section({ title, dims, scores, prev }: { title: string; dims: Dimension[]; scores: ScoreVector; prev: ScoreVector | null }) {
  return (
    <View className="gap-2">
      <Eyebrow className="px-1">{title}</Eyebrow>
      <GlassCard radius={26} className="overflow-hidden">
        {dims.map((d, i) => (
          <Row key={d} dim={d} scores={scores} prev={prev} last={i === dims.length - 1} />
        ))}
      </GlassCard>
    </View>
  );
}

export function Result({ scores, skinType, prev }: ResultProps) {
  return (
    <Screen className="px-6" contentStyle={{ paddingTop: 8, paddingBottom: 32 }}>
      <GlassCard flat intensity={26} radius={20} className="px-4 py-3 mb-5 mt-2">
        <Caption className="text-[11px] leading-[16px]">
          This describes how your skin looks today. It is not a medical diagnosis and TrueTone is not a medical device.
        </Caption>
      </GlassCard>

      <View className="gap-1 mb-1">
        <Display className="text-3xl">Your skin today</Display>
        <Text className="font-body-medium text-base" style={{ color: palette.mauve600 }}>
          Skin type feel: {SKIN_TYPE_LABELS[skinType]}
        </Text>
      </View>

      <View className="gap-5 mt-5">
        <Section title="Skin qualities" dims={QUALITY_DIMS} scores={scores} prev={prev} />
        <Section title="Appearance of" dims={APPEARANCE_DIMS} scores={scores} prev={prev} />
      </View>

      <GlassCard flat intensity={30} radius={22} className="px-5 py-4 mt-6" style={{ borderColor: palette.rose300 }}>
        <Body className="text-[13px] text-ink-soft">
          Notice something changing, painful, or unusual? TrueTone can&apos;t assess that — please see a dermatologist.
        </Body>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
});
