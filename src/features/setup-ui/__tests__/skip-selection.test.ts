import { toggleSkip } from '../skip-selection';
import type { Skip } from '../../../content/makeup-vocab';

describe('toggleSkip', () => {
  it('adds a skip that is not yet selected', () => {
    expect(toggleSkip([], 'fragrance')).toEqual(['fragrance']);
  });
  it('removes a skip that is already selected', () => {
    expect(toggleSkip(['fragrance', 'heavy_shimmer'], 'fragrance')).toEqual(['heavy_shimmer']);
  });
  it('does not mutate the input array', () => {
    const input: Skip[] = ['drying_matte'];
    toggleSkip(input, 'full_coverage');
    expect(input).toEqual(['drying_matte']);
  });
  it('accumulates a multi-select in order', () => {
    let sel: Skip[] = [];
    sel = toggleSkip(sel, 'fragrance');
    sel = toggleSkip(sel, 'heavy_shimmer');
    expect(sel).toEqual(['fragrance', 'heavy_shimmer']);
  });
});
