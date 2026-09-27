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
