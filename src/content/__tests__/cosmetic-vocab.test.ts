// src/content/__tests__/cosmetic-vocab.test.ts
import {
  DIMENSIONS, SKIN_TYPE_FEELS, BAND_LABELS, SKIN_TYPE_LABELS,
  DISEASE_BLOCKLIST, APPROVED_LABELS, SCORE_COLUMNS,
} from '../cosmetic-vocab';

test('exactly the eight approved dimensions', () => {
  expect([...DIMENSIONS]).toEqual([
    'hydration', 'oiliness', 'texture', 'pores',
    'darkSpots', 'redness', 'fineLines', 'darkCircles',
  ]);
});
test('each dimension has three ordered band labels', () => {
  for (const d of DIMENSIONS) expect(BAND_LABELS[d]).toHaveLength(3);
});
test('each dimension maps to a snake_case score column', () => {
  expect(SCORE_COLUMNS.darkSpots).toBe('score_dark_spots');
  expect(Object.keys(SCORE_COLUMNS).sort()).toEqual([...DIMENSIONS].sort());
});
test('approved labels include every band + skin-type label and no disease term', () => {
  expect(APPROVED_LABELS).toContain('Balanced');
  for (const term of DISEASE_BLOCKLIST) {
    expect(APPROVED_LABELS.join(' ').toLowerCase()).not.toContain(term);
  }
});
test('skin type feels are the four approved values', () => {
  expect([...SKIN_TYPE_FEELS]).toEqual(['dry', 'oily', 'combination', 'sensitive']);
  expect(SKIN_TYPE_LABELS.sensitive).toBe('Sensitive-feeling');
});
