import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptedStorage } from '../../../lib/encrypted-storage';
import { createOrderHistory, ORDER_HISTORY_KEY, type OrderStorage } from '../order-history-store';

/** A tiny in-memory stand-in for AsyncStorage that survives "restarts" (new store instances). */
function fakeStorage(initial: Record<string, string> = {}): OrderStorage & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: async (k) => data[k] ?? null,
    setItem: async (k, v) => {
      data[k] = v;
    },
    removeItem: async (k) => {
      delete data[k];
    },
  };
}

test('record writes the purchased ids to on-device storage', async () => {
  const storage = fakeStorage();
  const h = createOrderHistory(storage);
  await h.load();
  await h.record(['a', 'b']);
  expect(JSON.parse(storage.data[ORDER_HISTORY_KEY])).toEqual(['a', 'b']);
});

test('a fresh store (app restart) reloads the saved history', async () => {
  const storage = fakeStorage();
  const before = createOrderHistory(storage);
  await before.record(['a', 'b']);
  await before.record(['c']);

  const after = createOrderHistory(storage);
  expect(after.purchasedIds()).toEqual([]);
  await expect(after.load()).resolves.toEqual(['c', 'a', 'b']);
  expect(after.purchasedIds()).toEqual(['c', 'a', 'b']);
});

test('an order placed before the stored history finishes loading keeps both', async () => {
  const storage = fakeStorage({ [ORDER_HISTORY_KEY]: JSON.stringify(['old']) });
  const h = createOrderHistory(storage);
  const recorded = h.record(['new']);
  await h.load();
  await recorded;
  expect(h.purchasedIds()).toEqual(['new', 'old']);
  expect(JSON.parse(storage.data[ORDER_HISTORY_KEY])).toEqual(['new', 'old']);
});

test.each([
  ['unparseable JSON', '{not json'],
  ['a non-array value', JSON.stringify({ ids: ['a'] })],
  ['null', 'null'],
])('corrupt data (%s) falls back to an empty history, and the next order overwrites it', async (_label, raw) => {
  const storage = fakeStorage({ [ORDER_HISTORY_KEY]: raw });
  const h = createOrderHistory(storage);
  await expect(h.load()).resolves.toEqual([]);
  await h.record(['a']);
  expect(JSON.parse(storage.data[ORDER_HISTORY_KEY])).toEqual(['a']);
});

test('non-string and duplicate entries in stored data are dropped', async () => {
  const storage = fakeStorage({ [ORDER_HISTORY_KEY]: JSON.stringify(['a', 3, null, 'b', 'a', '']) });
  await expect(createOrderHistory(storage).load()).resolves.toEqual(['a', 'b']);
});

test('unreadable storage falls back to an empty history without throwing', async () => {
  const storage = { ...fakeStorage(), getItem: async () => Promise.reject(new Error('disk')) };
  const h = createOrderHistory(storage);
  await expect(h.load()).resolves.toEqual([]);
});

test('a failed write keeps the order in memory and does not throw', async () => {
  const storage = { ...fakeStorage(), setItem: async () => Promise.reject(new Error('full')) };
  const h = createOrderHistory(storage);
  await expect(h.record(['a'])).resolves.toBeUndefined();
  expect(h.purchasedIds()).toEqual(['a']);
});

test('clear removes the stored history', async () => {
  const storage = fakeStorage();
  const h = createOrderHistory(storage);
  await h.record(['a']);
  await h.clear();
  expect(storage.data[ORDER_HISTORY_KEY]).toBeUndefined();
  await expect(createOrderHistory(storage).load()).resolves.toEqual([]);
});

test('subscribers hear about loads, orders and clears', async () => {
  const storage = fakeStorage({ [ORDER_HISTORY_KEY]: JSON.stringify(['a']) });
  const h = createOrderHistory(storage);
  const listener = jest.fn();
  const unsubscribe = h.subscribe(listener);
  await h.load();
  await h.record(['b']);
  await h.clear();
  expect(listener).toHaveBeenCalledTimes(3);
  unsubscribe();
  await h.record(['c']);
  expect(listener).toHaveBeenCalledTimes(3);
});

test('the app-wide store persists through AsyncStorage, encrypted at rest', async () => {
  await AsyncStorage.clear();
  const { orderHistory } = jest.requireActual('../order-history-store');
  await orderHistory.record(['p1']);
  const raw = await AsyncStorage.getItem(ORDER_HISTORY_KEY);
  expect(raw).not.toContain('p1');
  expect(raw!.startsWith('enc1:')).toBe(true);
  expect(JSON.parse((await encryptedStorage.getItem(ORDER_HISTORY_KEY)) ?? 'null')).toEqual(['p1']);
});

test('a failed delete is reported, so delete-everything never claims success falsely', async () => {
  const storage = { ...fakeStorage(), removeItem: async () => Promise.reject(new Error('locked')) };
  const h = createOrderHistory(storage);
  await expect(h.clear()).rejects.toThrow('locked');
  expect(h.purchasedIds()).toEqual([]);
});

test('an order after a failed read never overwrites the stored history', async () => {
  const storage = fakeStorage({ [ORDER_HISTORY_KEY]: JSON.stringify(['old']) });
  const getItem = jest.fn().mockRejectedValue(new Error('disk'));
  const h = createOrderHistory({ ...storage, getItem, setItem: storage.setItem, removeItem: storage.removeItem });
  await h.load();
  await h.record(['new']);
  expect(JSON.parse(storage.data[ORDER_HISTORY_KEY])).toEqual(['old']);
  expect(h.purchasedIds()).toEqual(['new']);
});

test('a failed read is retried on the next load', async () => {
  const storage = fakeStorage({ [ORDER_HISTORY_KEY]: JSON.stringify(['old']) });
  const getItem = jest.fn().mockRejectedValueOnce(new Error('disk')).mockImplementation(storage.getItem);
  const h = createOrderHistory({ ...storage, getItem });
  await expect(h.load()).resolves.toEqual([]);
  await expect(h.load()).resolves.toEqual(['old']);
  await h.record(['new']);
  expect(JSON.parse(storage.data[ORDER_HISTORY_KEY])).toEqual(['new', 'old']);
});

test('clearing while the stored history is still loading does not bring it back', async () => {
  let release: (v: string) => void = () => undefined;
  const storage = fakeStorage();
  const h = createOrderHistory({ ...storage, getItem: () => new Promise((r) => (release = r)) });
  const loading = h.load();
  await h.clear();
  release(JSON.stringify(['old']));
  await loading;
  expect(h.purchasedIds()).toEqual([]);
});

test('an order still waiting on the read when history is cleared is not written back', async () => {
  let release: (v: string) => void = () => undefined;
  const storage = fakeStorage();
  const setItem = jest.fn(storage.setItem);
  const h = createOrderHistory({ ...storage, setItem, getItem: () => new Promise((r) => (release = r)) });
  const recorded = h.record(['a']);
  await h.clear();
  release(JSON.stringify(['old']));
  await recorded;
  expect(setItem).not.toHaveBeenCalled();
  expect(storage.data[ORDER_HISTORY_KEY]).toBeUndefined();
});
