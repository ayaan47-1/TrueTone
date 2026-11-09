import { View } from 'react-native';
import { palette } from '../../theme/tokens';
import type { ShadeLabels } from '../shade/shade-history';
import { shadeHistoryChipColor } from './shade-history-palette';

interface HistoryChipProps {
  scanId: string;
  shade: ShadeLabels | null;
  size?: number;
}

export const ILLUSTRATIVE_CHIP_COPY = 'Colour chips are illustrative, based on saved shade words, not a skin measurement.';

export function HistoryChip({ scanId, shade, size = 48 }: HistoryChipProps) {
  const backgroundColor = shade
    ? shadeHistoryChipColor(shade.depthBand, shade.undertone)
    : palette.mist200;
  const label = shade
    ? `${shade.shadeName} illustrative colour chip based on saved shade words, not a skin measurement`
    : 'Neutral placeholder chip; no saved shade words';

  return (
    <View
      testID={`shade-chip-${scanId}`}
      accessible
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        borderWidth: 1,
        borderColor: shade ? 'rgba(34,31,26,0.18)' : palette.mist400,
      }}
    />
  );
}
