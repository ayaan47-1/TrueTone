export interface ScheduleEntry {
  id: string;
  title: string;
  time: 'am' | 'pm';
  days: readonly string[];
}

export interface ScheduleBackend {
  load(): readonly ScheduleEntry[];
  save(entries: readonly ScheduleEntry[]): void;
}

function createMemoryBackend(): ScheduleBackend {
  let entries: readonly ScheduleEntry[] = [];
  return {
    load: () => entries,
    save: (next) => {
      entries = next;
    },
  };
}

export interface ScheduleStore {
  get(): readonly ScheduleEntry[];
  add(entry: ScheduleEntry): readonly ScheduleEntry[];
  remove(id: string): readonly ScheduleEntry[];
  toggleDay(id: string, day: string): readonly ScheduleEntry[];
  update(id: string, patch: Partial<Omit<ScheduleEntry, 'id'>>): readonly ScheduleEntry[];
}

export function createScheduleStore(backend: ScheduleBackend = createMemoryBackend()): ScheduleStore {
  return {
    get: () => backend.load(),
    add: (entry) => {
      const current = backend.load();
      if (current.some((e) => e.id === entry.id)) {
        return current;
      }
      const next = [...current, entry];
      backend.save(next);
      return next;
    },
    remove: (id) => {
      const next = backend.load().filter((e) => e.id !== id);
      backend.save(next);
      return next;
    },
    toggleDay: (id, day) => {
      const next = backend.load().map((e) => {
        if (e.id !== id) {
          return e;
        }
        const hasDay = e.days.includes(day);
        return {
          ...e,
          days: hasDay ? e.days.filter((d) => d !== day) : [...e.days, day],
        };
      });
      backend.save(next);
      return next;
    },
    update: (id, patch) => {
      const next = backend.load().map((e) => (e.id === id ? { ...e, ...patch } : e));
      backend.save(next);
      return next;
    },
  };
}

export const scheduleStore = createScheduleStore();
