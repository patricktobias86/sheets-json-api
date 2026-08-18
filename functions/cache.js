// In-memory cache with a short TTL, keyed by spreadsheet ID (and by
// spreadsheet + sheet). It lets us serve repeated requests for the same
// spreadsheet without hitting the Google Sheets API again as long as the
// previous request was less than CACHE_TTL_MS ago.
const CACHE_TTL_MS = 30_000;

const store = new Map();

/**
 * Return the cached value for `key` if it is still fresh (< 30s old) and
 * undefined otherwise. Expired entries are dropped lazily.
 */
export function localGet(key) {
  const entry = store.get(key);
  if (!entry) {
    return undefined;
  }

  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    store.delete(key);
    return undefined;
  }

  return entry.value;
}

/**
 * Store `value` under `key` with the current timestamp. Also prunes any
 * already-expired entries so the map does not grow without bound.
 */
export function localSet(key, value) {
  const now = Date.now();
  for (const [existingKey, entry] of store) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      store.delete(existingKey);
    }
  }

  store.set(key, { value, createdAt: now });
}

/**
 * Clear the whole cache. Used by tests to keep each test isolated.
 */
export function localClear() {
  store.clear();
}