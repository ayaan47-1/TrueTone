import { createShelfStore } from '../shelf-store';

describe('shelfStore', () => {
  it('starts empty', () => {
    const store = createShelfStore();
    expect(store.get()).toEqual([]);
  });

  it('add is idempotent', () => {
    const store = createShelfStore();
    store.add('p1');
    store.add('p1');
    expect(store.get()).toEqual(['p1']);
  });

  it('remove works', () => {
    const store = createShelfStore();
    store.add('p1');
    store.add('p2');
    store.remove('p1');
    expect(store.get()).toEqual(['p2']);
  });

  it('toggle adds then removes', () => {
    const store = createShelfStore();
    store.toggle('p1');
    expect(store.get()).toEqual(['p1']);
    store.toggle('p1');
    expect(store.get()).toEqual([]);
  });

  it('get returns a copy that does not mutate internal state', () => {
    const store = createShelfStore();
    store.add('p1');
    const copy = store.get();
    (copy as string[]).push('p2');
    expect(store.get()).toEqual(['p1']);
  });

  it('has reflects state', () => {
    const store = createShelfStore();
    expect(store.has('p1')).toBe(false);
    store.add('p1');
    expect(store.has('p1')).toBe(true);
    store.remove('p1');
    expect(store.has('p1')).toBe(false);
  });
});
