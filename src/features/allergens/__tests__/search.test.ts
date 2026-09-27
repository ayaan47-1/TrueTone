import { searchIngredients, validateFreeText } from '../search';

test('matches by INCI prefix', () => {
  expect(searchIngredients('methylisothia').map((i) => i.id)).toContain('methylisothiazolinone');
});

test('matches by common alias and trade name', () => {
  expect(searchIngredients('sweet almond').map((i) => i.id)).toContain('sweet_almond_oil');
  expect(searchIngredients('kathon').map((i) => i.id)).toEqual(
    expect.arrayContaining(['methylisothiazolinone', 'methylchloroisothiazolinone']),
  );
});

test('tolerates one typo for queries of 5+ characters only', () => {
  expect(searchIngredients('linalol').map((i) => i.id)).toContain('linalool');
  expect(searchIngredients('slz')).toEqual([]);
});

test('empty query returns nothing', () => {
  expect(searchIngredients('  ')).toEqual([]);
});

test('accepts an ingredient-name shape and normalizes it', () => {
  expect(validateFreeText('  Tea Tree (Melaleuca) Oil ')).toEqual({ ok: true, value: 'tea tree (melaleuca) oil' });
});

test.each([
  ['too long', 'a'.repeat(61)],
  ['too many words', 'one two three four five six seven'],
  ['bad characters', 'call me at 555-0100!'],
  ['disease term', 'eczema cream'],
  ['medical claim', 'hypoallergenic'],
  ['empty', '   '],
])('rejects free text: %s', (_label, text) => {
  expect(validateFreeText(text).ok).toBe(false);
});
