import { latestRead } from '../latest-read';
import type { ShadeReadInput } from '../../shade/shade-types';

const input: ShadeReadInput = {
  lightness: 0.5,
  warmth: 0.3,
  olive: 0.1,
  skinType: 'combination',
  oiliness: 0.4,
};

afterEach(() => latestRead.reset());

test('starts empty', () => {
  expect(latestRead.get()).toBeNull();
});

test('set stores a defensive copy of the tone read', () => {
  latestRead.set(input);
  const stored = latestRead.get();
  expect(stored).toEqual(input);
  expect(stored).not.toBe(input); // copy, not the caller's object
});

test('reset clears the stored read', () => {
  latestRead.set(input);
  latestRead.reset();
  expect(latestRead.get()).toBeNull();
});

test('subscribe fires on set and reset, and unsubscribe stops it', () => {
  const calls: number[] = [];
  const unsub = latestRead.subscribe(() => calls.push(1));
  latestRead.set(input);
  latestRead.reset();
  expect(calls).toHaveLength(2);
  unsub();
  latestRead.set(input);
  expect(calls).toHaveLength(2);
});
