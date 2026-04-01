const DEFAULT_TTL = 5 * 60 * 1000

interface CacheEntry<T = unknown> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry>()

export function cacheGet<T = unknown>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  return entry.value as T
}

export function cacheSet<T = unknown>(key: string, value: T, ttlMs: number = DEFAULT_TTL): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function cacheInvalidate(key: string): void {
  store.delete(key)
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
