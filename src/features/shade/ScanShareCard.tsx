// src/features/shade/ScanShareCard.tsx
// Pure, fixed-size branded card captured off-screen and handed to the OS share sheet
// (Task 10). Shows the derived cosmetic shade descriptors + TrueTone branding + the
// download link only -- no face, no source-photo URI, no scores, no health claims
// (CLAUDE.md §0/§1/§3). Consumes only CurrentShade, the same derived descriptor bundle
// ShadeResult renders; never the image.
import { View } from 'react-native';
import { Display, Body, Caption, Eyebrow } from '../../components/ui';
import { UNDERTONE_LABELS, FINISH_LABELS } from '../../content/makeup-vocab';
import { depthWord } from './derive-shade';
import type { CurrentShade } from './shade-types';

/** Fixed capture size (px) — high resolution for a crisp share image regardless of device. */
export const SCAN_SHARE_CARD_WIDTH = 1080;
export const SCAN_SHARE_CARD_HEIGHT = 1350;
export const SCAN_SHARE_DOWNLOAD_URL = 'https://truetone.app/download';

interface ScanShareCardProps {
  /** The derived shade to present — the same descriptors ShadeResult renders. */
  shade: CurrentShade;
}

/** Branded, fixed-size result card for sharing. Presentation only; captured by useScanShare. */
export function ScanShareCard({ shade }: ScanShareCardProps) {
  return (
    <View
      style={{ width: SCAN_SHARE_CARD_WIDTH, height: SCAN_SHARE_CARD_HEIGHT, backgroundColor: '#FBF6EF' }}
      className="items-center justify-center gap-10 px-20"
    >
      <Eyebrow>My TrueTone shade</Eyebrow>
      <Display>{shade.shadeName}</Display>
      <Body className="text-ink-soft text-center">
        {`${depthWord(shade.depth)} · ${UNDERTONE_LABELS[shade.undertone]} · ${FINISH_LABELS[shade.finish]}`}
      </Body>
      <View className="mt-16 items-center gap-2">
        <Caption className="uppercase tracking-[1.4px]">TrueTone</Caption>
        <Body className="text-ink-soft">{SCAN_SHARE_DOWNLOAD_URL}</Body>
      </View>
    </View>
  );
}
