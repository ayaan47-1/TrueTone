export interface ShelfBackend {
  load(): readonly string[];
  save(ids: readonly string[]): void;
}

function createMemoryBackend(): ShelfBackend {
  let v: readonly string[] = [];
  return {
    load: () => v,
    save: (ids) => {
      v = ids;
    },
  };
}

export interface ShelfStore {
  get(): readonly string[];
  has(id: string): boolean;
  add(id: string): readonly string[];
  remove(id: string): readonly string[];
  toggle(id: string): readonly string[];
}

export function createShelfStore(backend: ShelfBackend = createMemoryBackend()): ShelfStore {
  const get = (): readonly string[] => [...backend.load()];

  const has = (id: string): boolean => backend.load().includes(id);

  const add = (id: string): readonly string[] => {
    const current = backend.load();
    const next = current.includes(id) ? current : [...current, id];
    backend.save(next);
    return get();
  };

  const remove = (id: string): readonly string[] => {
    const next = backend.load().filter((existing) => existing !== id);
    backend.save(next);
    return get();
  };

  const toggle = (id: string): readonly string[] => (has(id) ? remove(id) : add(id));

  return { get, has, add, remove, toggle };
}

export const shelfStore = createShelfStore();
