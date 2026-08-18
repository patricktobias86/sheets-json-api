// In-memory cache with a short TTL, keyed by spreadsheet ID (and by
// spreadsheet + sheet). It lets us serve repeated requests for the same
// spreadsheet without hitting the Google Sheets API again as long as the
// previous request was less than CACHE_TTL_MS ago.
const CACHE_TTL_MS = 60_000;

const store = new Map();

/**
 * Return the cached value for `key` if it is still fresh (< 60s old) and
 * undefined otherwise. Expired entries are dropped lazily.
 *
 * The window is a *sliding* 60 seconds measured from the last request: every
 * read of a fresh entry refreshes its age, so a sheet that keeps being asked
 * for within 60s stays in cache. An entry only expires after 60s have passed
 * with no request for it.
 */
export function localGet(key) {
  const entry = store.get(key);
  if (!entry) {
    return undefined;
  }

  const now = Date.now();
  if (now - entry.createdAt > CACHE_TTL_MS) {
    store.delete(key);
    return undefined;
  }

  entry.createdAt = now;
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