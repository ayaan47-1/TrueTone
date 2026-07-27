// Shared sampling window for capture-quality metrics. The gate already requires a centered face,
// so a centered crop is a stable, orientation-agnostic approximation of the face area without
// coupling the frame processor to detector-coordinate conversions.

export interface GridBounds {
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
}

export const FACE_SAMPLE_FRACTION = 0.6;

function centeredSpan(size: number): number {
  if (size <= 0) return 0;
  if (size <= 2) return size;

  let span = Math.min(size, Math.ceil(size * FACE_SAMPLE_FRACTION));
  // Even spans split cleanly into equal sides for the illumination-balance metric.
  if (span % 2 !== 0) span += span < size ? 1 : -1;
  return Math.max(2, span);
}

export function centeredGridBounds(cols: number, rows: number): GridBounds {
  const width = centeredSpan(cols);
  const height = centeredSpan(rows);
  const startCol = Math.floor((cols - width) / 2);
  const startRow = Math.floor((rows - height) / 2);
  return {
    startCol,
    endCol: startCol + width,
    startRow,
    endRow: startRow + height,
  };
}
