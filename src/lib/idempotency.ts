const cache = new Map<string, { response: unknown; expires: number }>();

export function checkIdempotency(key: string | null): unknown | null {
  if (!key) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.response;
}

export function storeIdempotency(key: string | null, response: unknown) {
  if (!key) return;
  cache.set(key, { response, expires: Date.now() + 24 * 60 * 60 * 1000 });
}
