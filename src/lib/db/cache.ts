// Placeholder cache implementation. In production this could wrap Redis or Vercel KV.

interface CacheStore {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, ttlSeconds?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
}

const inMemoryCache = new Map<string, { expiresAt: number; value: unknown }>();

const DEFAULT_TTL = 60;

export const cache: CacheStore = {
  async get<T>(key: string) {
    const record = inMemoryCache.get(key);
    if (!record) return null;
    if (record.expiresAt < Date.now()) {
      inMemoryCache.delete(key);
      return null;
    }
    return record.value as T;
  },
  async set(key: string, value: unknown, ttlSeconds = DEFAULT_TTL) {
    inMemoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  },
  async del(key: string) {
    inMemoryCache.delete(key);
  }
};
