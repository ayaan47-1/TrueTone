// src/features/shade/__tests__/shade-history.test.ts
// Shade-history labels (Dwight ruling): the matched shade is saved and shown as WORDS only.
import { toShadeLabels, formatShadeMatch } from '../shade-history';
import type { CurrentShade } from '../../session/personalization';

const shade: CurrentShade = { shadeName: 'Tan Warm', undertone: 'warm', depth: 7, finish: 'satin' };

test('toShadeLabels maps the numeric depth to a band word and drops the number', () => {
  const labels = toShadeLabels(shade);
  expect(labels).toEqual({ depthBand: 'tan', undertone: 'warm', finish: 'satin', shadeName: 'Tan Warm' });
  expect(Object.values(labels).some((v) => typeof v === 'number')).toBe(false);
});

test.each([[1, 'fair'], [3, 'light'], [5, 'medium'], [8, 'tan'], [10, 'deep']] as const)(
  'depth %i maps to the %s band',
  (depth, band) => {
    expect(toShadeLabels({ ...shade, depth }).depthBand).toBe(band);
  },
);

test('formatShadeMatch renders "Band · Undertone · Finish" with no digits', () => {
  const text = formatShadeMatch({ depthBand: 'tan', undertone: 'warm', finish: 'satin', shadeName: 'Tan Warm' });
  expect(text).toBe('Tan · Warm · Satin');
  expect(text).not.toMatch(/[0-9%]/);
});
