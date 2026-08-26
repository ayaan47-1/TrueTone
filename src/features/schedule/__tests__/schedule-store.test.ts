import { createScheduleStore } from '../schedule-store';
import type { ScheduleEntry } from '../schedule-store';

function makeEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return { id: 'e1', title: 'AM cleanse', time: 'am', days: ['Mon', 'Wed'], ...overrides };
}

describe('scheduleStore', () => {
  it('starts empty and appends on add, ignoring duplicate ids', () => {
    const store = createScheduleStore();
    expect(store.get()).toEqual([]);

    store.add(makeEntry());
    const afterDup = store.add(makeEntry({ title: 'duplicate id attempt' }));

    expect(afterDup).toHaveLength(1);
    expect(afterDup[0].title).toBe('AM cleanse');
  });

  it('removes an entry by id', () => {
    const store = createScheduleStore();
    store.add(makeEntry({ id: 'e1' }));
    store.add(makeEntry({ id: 'e2', title: 'PM moisturize', time: 'pm' }));

    const after = store.remove('e1');

    expect(after.map((e) => e.id)).toEqual(['e2']);
  });

  it('toggleDay adds then removes a day without mutating other entries', () => {
    const store = createScheduleStore();
    store.add(makeEntry({ id: 'e1', days: ['Mon'] }));
    store.add(makeEntry({ id: 'e2', days: ['Tue'] }));

    const afterAdd = store.toggleDay('e1', 'Fri');
    const e1AfterAdd = afterAdd.find((e) => e.id === 'e1');
    const e2AfterAdd = afterAdd.find((e) => e.id === 'e2');
    expect(e1AfterAdd?.days).toEqual(['Mon', 'Fri']);
    expect(e2AfterAdd?.days).toEqual(['Tue']);

    const afterRemove = store.toggleDay('e1', 'Fri');
    expect(afterRemove.find((e) => e.id === 'e1')?.days).toEqual(['Mon']);
  });

  it('update patches fields immutably', () => {
    const store = createScheduleStore();
    store.add(makeEntry({ id: 'e1', title: 'AM cleanse' }));

    const after = store.update('e1', { title: 'AM cleanse + serum' });

    expect(after.find((e) => e.id === 'e1')?.title).toBe('AM cleanse + serum');
  });

  it('get returns a copy, not a live reference the caller can mutate', () => {
    const store = createScheduleStore();
    store.add(makeEntry({ id: 'e1' }));

    const first = store.get();
    store.add(makeEntry({ id: 'e2', title: 'second' }));
    const second = store.get();

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
    expect(first).not.toBe(second);
  });
});
