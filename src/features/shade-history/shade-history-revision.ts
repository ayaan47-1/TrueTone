type ShadeHistoryListener = () => void;

let revision = 0;
const listeners = new Set<ShadeHistoryListener>();

export function getShadeHistoryRevision(): number {
  return revision;
}

export function subscribeShadeHistoryRevision(listener: ShadeHistoryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function bumpShadeHistoryRevision(): void {
  revision += 1;
  listeners.forEach((listener) => listener());
}
