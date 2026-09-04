/**
 * Shared GLB URL promise cache + concurrency-limited parallel load.
 * Does not change persisted asset paths.
 */

export type LoadTask<T> = () => Promise<T>;

const glbUrlPromiseCache = new Map<string, Promise<unknown>>();

export function getCachedGlbLoad<T>(url: string): Promise<T> | undefined {
  return glbUrlPromiseCache.get(url) as Promise<T> | undefined;
}

export function setCachedGlbLoad<T>(url: string, promise: Promise<T>): Promise<T> {
  glbUrlPromiseCache.set(url, promise as Promise<unknown>);
  promise.then(result => {
    if (result === false && glbUrlPromiseCache.get(url) === promise) {
      glbUrlPromiseCache.delete(url);
    }
  }).catch(() => {
    if (glbUrlPromiseCache.get(url) === promise) glbUrlPromiseCache.delete(url);
  });
  return promise;
}

export function clearGlbUrlCache(url?: string) {
  if (url) glbUrlPromiseCache.delete(url);
  else glbUrlPromiseCache.clear();
}

/**
 * Run async tasks with a concurrency cap (default 4).
 */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const results = new Array<R>(items.length);
  let next = 0;

  async function runOne() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runOne());
  await Promise.all(runners);
  return results;
}

export const DEFAULT_GLB_LOAD_CONCURRENCY = 4;
