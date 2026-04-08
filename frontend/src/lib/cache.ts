const DEFAULT_TTL = 5 * 60 * 1000
const MAX_ENTRIES = 200

interface CacheEntry<T = unknown> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry>()

function evictExpired(): void {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key)
  }
}

function evictIfNeeded(): void {
  if (store.size <= MAX_ENTRIES) return
  evictExpired()
  if (store.size <= MAX_ENTRIES) return

  const overflow = store.size - MAX_ENTRIES
  const keys = store.keys()
  for (let i = 0; i < overflow; i++) {
    const { value, done } = keys.next()
    if (done) break
    store.delete(value)
  }
}

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
  evictIfNeeded()
}

export function cacheInvalidate(key: string): void {
  store.delete(key)
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
