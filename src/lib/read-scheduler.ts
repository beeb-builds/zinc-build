// In-memory browser cache only. Server reads bypass this scheduler entirely.
export function createReadScheduler(limit = 6, ttlMs = 0, maxEntries = 200, now = () => Date.now()) {
  let active = 0;
  const queue: (() => void)[] = [];
  const pending = new Map<string, Promise<unknown>>();
  const cache = new Map<string, { value: unknown; expiresAt: number }>();
  function invalidate(key?: string) {
    if (key !== undefined) { pending.delete(key); cache.delete(key); }
    else { pending.clear(); cache.clear(); }
  }
  function schedule<T>(key: string, read: () => Promise<T>, fresh = false): Promise<T> {
    if (fresh) invalidate(key);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) {
      cache.delete(key); cache.set(key, cached);
      return Promise.resolve(cached.value as T);
    }
    cache.delete(key);
    const existing = pending.get(key);
    if (existing) return existing as Promise<T>;
    const result = new Promise<T>((resolve, reject) => {
      const start = () => {
        active++;
        Promise.resolve().then(read).then(resolve, reject).finally(() => {
          active--;
          queue.shift()?.();
        });
      };
      if (active < limit) start(); else queue.push(start);
    });
    pending.set(key, result);
    void result.then((value) => {
      // Invalidated requests can complete for their callers but cannot refill cache.
      if (pending.get(key) !== result) return;
      pending.delete(key);
      if (ttlMs > 0 && maxEntries > 0 && value !== undefined && value !== null) {
        cache.set(key, { value, expiresAt: now() + ttlMs });
        while (cache.size > maxEntries) cache.delete(cache.keys().next().value!);
      }
    }, () => { if (pending.get(key) === result) pending.delete(key); });
    return result;
  }
  return { schedule, invalidate };
}

export const browserReads = createReadScheduler(6, 10_000);
export const READS_INVALIDATED = "zinc-reads-invalidated";
let activeWrites = 0;
export function beginBrowserWrite() {
  activeWrites++;
  return () => { activeWrites = Math.max(0, activeWrites - 1); };
}
export function isBrowserWriteActive() { return activeWrites > 0; }

export function invalidateReadCache() {
  browserReads.invalidate();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(READS_INVALIDATED));
}
