import { shadeHistoryChipColor } from '../shade-history-palette';

describe('shade history palette', () => {
  it('uses bundled design tokens keyed only by band and undertone', () => {
    expect(shadeHistoryChipColor('tan', 'warm')).toMatch(/^#[0-9A-F]{6}$/i);
    expect(shadeHistoryChipColor('tan', 'warm')).not.toBe(shadeHistoryChipColor('tan', 'cool'));
    expect(shadeHistoryChipColor('tan', 'warm')).not.toBe(shadeHistoryChipColor('deep', 'warm'));
  });
});
