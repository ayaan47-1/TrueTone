// src/features/shade/ShadeResult.tsx
// Presentational scan-result card for the derived makeup shade (plan B2). Pure props in,
// callbacks out — no store wiring, no routing, no data fetching. The screen route (owned
// elsewhere) derives the shade, persists it, and renders this with the derived shade +
// no-op handlers passed in. Styling mirrors app/setup/goals.tsx.
//
// Compliance: every string here is makeup/shade language only (cosmetic — no skin-health
// or condition terms), and the shade depth is shown qualitatively (depthWord), never as a
// raw number (CLAUDE.md §0/§1, plan Flag 4).
import { View } from 'react-native';
import { Screen, HEADER_CLEARANCE, Eyebrow, Heading, Display, Body, Caption, PrimaryButton, GlassCard } from '../../components/ui';
import { UNDERTONE_LABELS, FINISH_LABELS, type Finish } from '../../content/makeup-vocab';
import { depthWord } from './derive-shade';
import type { CurrentShade } from './shade-types';

interface ShadeResultProps {
  /** The derived shade to present. */
  shade: CurrentShade;
  /** Optional cosmetic tip line; a finish-appropriate default is used when omitted. */
  tip?: string;
  /** Optional product-picks slot (e.g. a "Picked for your shade" rail), rendered
   *  between the tip and the CTAs. The route owns ranking; this is presentation only. */
  picks?: React.ReactNode;
  /** Fired by "See my look" (no-op wiring lives in the route). */
  onSeeLook?: () => void;
  /** Fired by "Share" (share sheet is a shell this phase). */
  onShare?: () => void;
}

// Cosmetic-only tip copy, one per finish. No skin-health claims.
const FINISH_TIP: Record<Finish, string> = {
  sheer: 'Press on a sheer layer and let your skin peek through.',
  natural: 'A natural finish keeps things looking like you, only fresher.',
  satin: 'A satin finish gives a soft, lit-from-within glow.',
  dewy: 'Tap on a dewy base for that just-hydrated glass look.',
  matte: 'A matte base keeps your look looking fresh all day.',
  glam: 'Build up the glam finish for a full, camera-ready look.',
};

// Small representative swatch colours per descriptor (display only).
const UNDERTONE_SWATCH: Record<CurrentShade['undertone'], string> = {
  warm: '#E0A46B',
  cool: '#D7A6A0',
  neutral: '#D9B79A',
  olive: '#B7A375',
};
const FINISH_SWATCH: Record<Finish, string> = {
  sheer: '#F0E4D8',
  natural: '#E7D3BE',
  satin: '#E9C9A6',
  dewy: '#F3D9BE',
  matte: '#D8BFA3',
  glam: '#E9B98A',
};

function Swatch({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-2">
      <View
        accessibilityRole="image"
        accessibilityLabel={`${label}: ${value}`}
        style={{ backgroundColor: color }}
        className="h-12 w-12 rounded-full border border-ink-faint"
      />
      <Caption className="uppercase tracking-[1px]">{label}</Caption>
      <Body className="text-ink-soft">{value}</Body>
    </View>
  );
}

/** The derived-shade result card. Hero shade + undertone/depth/finish swatches + CTAs. */
export function ShadeResult({ shade, tip, picks, onSeeLook, onShare }: ShadeResultProps) {
  const tipLine = tip ?? FINISH_TIP[shade.finish];

  return (
    <Screen className="px-6" topGap={HEADER_CLEARANCE}>
      <View className="flex-1 gap-8">
        <View className="gap-3">
          <Eyebrow>Your shade</Eyebrow>
          <Heading>We found your match</Heading>
        </View>

        {/* Hero shade card */}
        <GlassCard className="items-center gap-2 px-6 py-8" radius={32}>
          <Caption className="uppercase tracking-[1.4px]">Today's shade</Caption>
          <Display>{shade.shadeName}</Display>
          <Body className="text-ink-soft">
            {`${depthWord(shade.depth)} · ${UNDERTONE_LABELS[shade.undertone]} · ${FINISH_LABELS[shade.finish]}`}
          </Body>
        </GlassCard>

        {/* Undertone / depth / finish swatches */}
        <View className="flex-row gap-3">
          <Swatch color={UNDERTONE_SWATCH[shade.undertone]} label="Undertone" value={UNDERTONE_LABELS[shade.undertone]} />
          <Swatch color={FINISH_SWATCH[shade.finish]} label="Depth" value={depthWord(shade.depth)} />
          <Swatch color={FINISH_SWATCH[shade.finish]} label="Finish" value={FINISH_LABELS[shade.finish]} />
        </View>

        {/* Cosmetic tip line */}
        <GlassCard flat className="gap-1 px-5 py-4" radius={22}>
          <Caption className="uppercase tracking-[1.2px] text-brand-green">Today's tip</Caption>
          <Body className="text-ink-soft">{tipLine}</Body>
        </GlassCard>

        {/* Product picks slot (route-owned ranking) */}
        {picks}

        <View className="mt-auto gap-3 pb-2">
          <PrimaryButton label="See my look" onPress={onSeeLook} />
          <PrimaryButton label="Share" variant="glass" onPress={onShare} />
        </View>
      </View>
    </Screen>
  );
}
