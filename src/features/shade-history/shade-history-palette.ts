import type { Undertone } from '../../content/makeup-vocab';
import type { DepthBand } from '../shade/shade-history';

/**
 * Decorative history-chip colours. These are bundled design tokens keyed by saved words,
 * not reconstructed measurements and not a representation of a person's skin colour.
 */
const SHADE_HISTORY_PALETTE: Record<DepthBand, Record<Undertone, string>> = {
  fair: { warm: '#E7C3A2', cool: '#E4C0B7', neutral: '#DEC1AA', olive: '#D8C09C' },
  light: { warm: '#D9A67E', cool: '#D3A09C', neutral: '#CFA58A', olive: '#C7A574' },
  medium: { warm: '#BD8058', cool: '#B47B75', neutral: '#B08365', olive: '#A68152' },
  tan: { warm: '#9A5E3D', cool: '#925A55', neutral: '#8F624B', olive: '#80613D' },
  deep: { warm: '#6B3D28', cool: '#633A3B', neutral: '#5F4032', olive: '#55442D' },
};

export function shadeHistoryChipColor(depthBand: DepthBand, undertone: Undertone): string {
  return SHADE_HISTORY_PALETTE[depthBand][undertone];
}
