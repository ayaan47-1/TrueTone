import { FINISH_LABELS, UNDERTONE_LABELS } from '../../content/makeup-vocab';
import type { ShadeLabels } from '../shade/shade-history';

const DEPTH_LABELS: Record<ShadeLabels['depthBand'], string> = {
  fair: 'Fair',
  light: 'Light',
  medium: 'Medium',
  tan: 'Tan',
  deep: 'Deep',
};

export function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function depthLabel(shade: ShadeLabels): string {
  return DEPTH_LABELS[shade.depthBand];
}

export function undertoneLabel(shade: ShadeLabels): string {
  return UNDERTONE_LABELS[shade.undertone];
}

export function finishLabel(shade: ShadeLabels): string {
  return FINISH_LABELS[shade.finish];
}
