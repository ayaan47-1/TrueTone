import { nextRoute } from '../routing-guard';

test('non-US blocks to region screen', () => {
  expect(nextRoute({ isUS: false, is18: true, consent: true })).toBe('region-blocked');
});
test('unknown region fails closed to region screen', () => {
  expect(nextRoute({ isUS: null, is18: true, consent: true })).toBe('region-blocked');
});
test('US but not 18 -> age gate', () => {
  expect(nextRoute({ isUS: true, is18: false, consent: false })).toBe('age-gate');
});
test('US + 18 but no consent -> consent', () => {
  expect(nextRoute({ isUS: true, is18: true, consent: false })).toBe('consent');
});
test('all pass -> home', () => {
  expect(nextRoute({ isUS: true, is18: true, consent: true })).toBe('home');
});
