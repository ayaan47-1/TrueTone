import {
  emptyProfile, toggleGroup, addIngredient, addUnresolved, removeEntry, flaggedCount, parseProfile,
  hasHealthData, MAX_UNRESOLVED,
} from '../profile';

test('an empty profile records only the answer', () => {
  const p = emptyProfile('skipped', '2026-09-27T00:00:00Z');
  expect(p).toMatchObject({ version: 1, answer: 'skipped', groups: [], ingredients: [], unresolved: [] });
  expect(p.display).toBe('hide');
  expect(p.unknownDisplay).toBe('show');
  expect(hasHealthData(p)).toBe(false);
});

test('toggling a group is immutable and referral-only groups are never saved', () => {
  const p = emptyProfile('yes', 't');
  const q = toggleGroup(p, 'fragrance');
  expect(p.groups).toEqual([]);
  expect(q.groups).toEqual(['fragrance']);
  expect(toggleGroup(q, 'fragrance').groups).toEqual([]);
  expect(toggleGroup(q, 'latex').groups).toEqual(['fragrance']);
});

test('adding ingredients and unresolved names dedupes and counts', () => {
  let p = addIngredient(emptyProfile('yes', 't'), 'linalool');
  p = addIngredient(p, 'linalool');
  p = addUnresolved(p, 'tea tree (melaleuca) oil');
  expect(p.ingredients).toEqual(['linalool']);
  expect(flaggedCount(toggleGroup(p, 'parabens'))).toBe(3);
  expect(hasHealthData(p)).toBe(true);
  expect(removeEntry(p, 'ingredient', 'linalool').ingredients).toEqual([]);
  expect(removeEntry(p, 'unresolved', 'tea tree (melaleuca) oil').unresolved).toEqual([]);
});

test('unknown ingredient ids and invalid free text are ignored; unresolved is capped', () => {
  let p = addIngredient(emptyProfile('yes', 't'), 'not-a-real-id');
  p = addUnresolved(p, 'eczema cream');
  expect(flaggedCount(p)).toBe(0);
  for (let i = 0; i < MAX_UNRESOLVED + 5; i++) p = addUnresolved(p, `name ${i}`);
  expect(p.unresolved).toHaveLength(MAX_UNRESOLVED);
});

test('parseProfile validates stored JSON and drops anything malformed', () => {
  const good = toggleGroup(emptyProfile('yes', 't'), 'mit');
  expect(parseProfile(JSON.stringify(good))).toEqual(good);
  expect(parseProfile('not json')).toBeNull();
  expect(parseProfile(JSON.stringify({ ...good, version: 2 }))).toBeNull();
  expect(parseProfile(JSON.stringify({ ...good, groups: ['latex', 'fragrance', 42] }))?.groups).toEqual(['fragrance']);
});

describe('a flag is never silently dropped on read (spec E13, code review M3)', () => {
  const { migrateIngredientId } = require('../../../content/ingredients/version');
  const base = emptyProfile('yes', '2026-09-27T00:00:00Z');

  test('an ingredient id no longer in the dictionary moves to unresolved as a readable name', () => {
    const out = parseProfile(JSON.stringify({ ...base, ingredients: ['linalool', 'retired_thing'] }));
    expect(out?.ingredients).toEqual(['linalool']);
    expect(out?.unresolved).toEqual(['retired thing']);
  });

  test('a renamed id follows the migration map', () => {
    expect(migrateIngredientId('old_linalool', { old_linalool: 'linalool' })).toBe('linalool');
    expect(migrateIngredientId('linalool', {})).toBe('linalool');
  });

  test('reading never trims stored entries to the write-time caps', () => {
    const many = Array.from({ length: MAX_UNRESOLVED + 3 }, (_, i) => `name ${String.fromCharCode(97 + i)}`);
    const out = parseProfile(JSON.stringify({ ...base, unresolved: many }));
    expect(out?.unresolved).toHaveLength(MAX_UNRESOLVED + 3);
  });
});
