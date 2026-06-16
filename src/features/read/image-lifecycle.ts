// src/features/read/image-lifecycle.ts
// Guarantees the raw face image is deleted after the read — even on failure — and
// never lets a cleanup error surface as a data-leak path (CLAUDE.md §1, §3).
export type FileDeleter = (uri: string) => Promise<void>;

export async function withImageCleanup<T>(
  uri: string,
  fn: (uri: string) => Promise<T>,
  del: FileDeleter,
  opts: { retries?: number; onCleanupFailure?: () => void } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  try {
    return await fn(uri);
  } finally {
    let ok = false;
    for (let attempt = 0; attempt <= retries && !ok; attempt++) {
      try {
        await del(uri);
        ok = true;
      } catch {
        // swallow and retry — cleanup must never throw out of finally
      }
    }
    if (!ok) opts.onCleanupFailure?.();
  }
}
